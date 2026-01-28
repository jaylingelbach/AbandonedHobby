import { z } from 'zod';

// ─── Types ───────────────────────────────────────────────────────────────────
import type { CollectionAfterChangeHook, PayloadRequest } from 'payload';
import type { ModerationAction, Product, User } from '@/payload-types';

// ─── Access Control ──────────────────────────────────────────────────────────
import { isStaff, isSuperAdmin } from '@/lib/access';

// ─── Constants ───────────────────────────────────────────────────────────────
import {
  moderationFlagReasons,
  moderationReinstateReasons,
  moderationSource,
  roleTypes
} from '@/constants';

// ─── Server Utilities ────────────────────────────────────────────────────────
import { isUniqueViolation } from '@/lib/server/errors/errors';

type HookContext = {
  skipModerationIntentHook?: boolean;
  skipSideEffects?: boolean;
};

const isoDateTimeSchema = z.string().datetime();

const moderationIntentSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('approved'),
    source: z.enum(moderationSource),
    note: z.string().min(1).optional(),
    createdAt: isoDateTimeSchema,
    intentId: z.string().uuid()
  }),
  z.object({
    actionType: z.literal('removed'),
    source: z.enum(moderationSource),
    reason: z.enum(moderationFlagReasons),
    note: z.string().min(1),
    createdAt: isoDateTimeSchema,
    intentId: z.string().uuid()
  }),
  z.object({
    actionType: z.literal('reinstated'),
    source: z.enum(moderationSource),
    reason: z.enum(moderationReinstateReasons),
    note: z.string().min(1),
    createdAt: isoDateTimeSchema,
    intentId: z.string().uuid()
  })
]);

function isUserRoleArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function assertStaffUser(user: User | null): asserts user is User {
  if (!user) throw new Error('Not authenticated');
  if (!isUserRoleArray(user.roles))
    throw new Error('User roles are not available');
  if (!(isSuperAdmin(user) || isStaff(user))) throw new Error('Forbidden');
}

/**
 * Extract a best-effort intentId from an unknown moderationIntent object.
 * We intentionally do NOT fully validate here — we just need a stable key to compare prev vs next.
 */
function getIntentId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const record: Record<string, unknown> = value as Record<string, unknown>;
  const maybeIntentId = record.intentId;
  return typeof maybeIntentId === 'string' ? maybeIntentId : null;
}

/**
 * Run an internal Product write using the same request, but with recursion/side-effect guards.
 * Restores previous req.context afterwards.
 */
async function runInternalProductWrite(params: {
  req: PayloadRequest;
  run: () => Promise<void>;
}): Promise<void> {
  const { req, run } = params;

  const previousContext = (req.context ?? {}) as HookContext;

  const nextContext = {
    ...previousContext,
    skipModerationIntentHook: true,
    skipSideEffects: true
  } satisfies HookContext;

  req.context = nextContext as unknown as PayloadRequest['context'];

  try {
    await run();
  } finally {
    req.context = previousContext as unknown as PayloadRequest['context'];
  }
}

async function clearModerationIntent(params: {
  req: PayloadRequest;
  productId: string;
}): Promise<void> {
  const { req, productId } = params;

  await runInternalProductWrite({
    req,
    run: async () => {
      await req.payload.update({
        collection: 'products',
        id: productId,
        data: { moderationIntent: null },
        overrideAccess: true,
        req
      });
    }
  });
}

async function clearLatestRemovalSummary(params: {
  req: PayloadRequest;
  productId: string;
}): Promise<void> {
  const { req, productId } = params;

  await runInternalProductWrite({
    req,
    run: async () => {
      await req.payload.update({
        collection: 'products',
        id: productId,
        overrideAccess: true,
        req,
        data: {
          // Clearing the group is the safest approach across Payload versions.
          latestRemovalSummary: undefined
        }
      });
    }
  });
}

async function writeLatestRemovalSummary(params: {
  req: PayloadRequest;
  productId: string;
  summary: {
    actionId?: string;
    intentId: string;
    removedAt: string;
    reason: (typeof moderationFlagReasons)[number];
    note: string;
    source: (typeof moderationSource)[number];
    actorId: string;
    actorRoleSnapshot: Array<(typeof roleTypes)[number]>;
    actorEmailSnapshot?: string | null;
    actorUsernameSnapshot?: string | null;
  };
}): Promise<void> {
  const { req, productId, summary } = params;

  await runInternalProductWrite({
    req,
    run: async () => {
      await req.payload.update({
        collection: 'products',
        id: productId,
        overrideAccess: true,
        req,
        data: {
          latestRemovalSummary: {
            actionId: summary.actionId,
            intentId: summary.intentId,
            removedAt: summary.removedAt,
            reason: summary.reason,
            note: summary.note,
            source: summary.source,
            actorId: summary.actorId,
            actorRoleSnapshot: summary.actorRoleSnapshot,
            actorEmailSnapshot: summary.actorEmailSnapshot ?? null,
            actorUsernameSnapshot: summary.actorUsernameSnapshot ?? null
          }
        }
      });
    }
  });
}

async function findModerationActionByIntentId(params: {
  req: PayloadRequest;
  intentId: string;
}): Promise<ModerationAction | null> {
  const { req, intentId } = params;

  const result = await req.payload.find({
    collection: 'moderation-actions',
    depth: 0,
    overrideAccess: true,
    req,
    where: { intentId: { equals: intentId } },
    limit: 1,
    pagination: false
  });

  const first = result.docs[0];
  return first ?? null;
}

/**
 * After-change hook for Products:
 * - If `moderationIntent` is newly written in this change, create a ModerationAction audit row.
 * - Maintain Product.latestRemovalSummary for "removed" / clear it for "reinstated".
 * - Then clear `moderationIntent` (with a recursion guard).
 *
 * IMPORTANT:
 * - This hook must NOT keep firing forever if a stale moderationIntent is left behind.
 *   We only execute when the intent changes vs previousDoc (new intentId).
 */
export const createModerationActionFromIntent: CollectionAfterChangeHook<
  Product
> = async ({ doc, req, previousDoc }) => {
  const user = req.user as User | null;
  if (!user) throw new Error('Not authenticated');

  const context = (req.context ?? {}) as HookContext;
  if (context.skipModerationIntentHook || context.skipSideEffects) {
    return doc;
  }

  const nextIntentRaw: unknown = (
    doc as unknown as { moderationIntent?: unknown }
  ).moderationIntent;

  if (!nextIntentRaw) return doc;

  // ✅ Guard: only run when intentId changes vs previous doc.
  const prevIntentRaw: unknown = (
    previousDoc as unknown as { moderationIntent?: unknown } | undefined
  )?.moderationIntent;

  const prevIntentId = getIntentId(prevIntentRaw);
  const nextIntentId = getIntentId(nextIntentRaw);

  if (prevIntentId && nextIntentId && prevIntentId === nextIntentId) {
    await clearModerationIntent({ req, productId: doc.id });
    return doc;
  }

  const parsed = moderationIntentSchema.safeParse(nextIntentRaw);
  if (!parsed.success) {
    // Best-effort: clear invalid marker so it doesn't brick future writes.
    await clearModerationIntent({ req, productId: doc.id });
    throw new Error(
      `Invalid moderationIntent: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    );
  }

  const intent = parsed.data;
  const actionType = intent.actionType;

  assertStaffUser(user);

  const prevRemoved = Boolean(previousDoc?.isRemovedForPolicy);
  const nextRemoved = Boolean(doc.isRemovedForPolicy);

  const prevFlagged = Boolean(previousDoc?.isFlagged);
  const nextFlagged = Boolean(doc.isFlagged);

  // -----------------------------
  // Transition sanity checks
  // (If mismatch, clear marker so it can't brick future writes)
  // -----------------------------
  if (actionType === 'removed') {
    if (prevRemoved && nextRemoved) {
      await clearModerationIntent({ req, productId: doc.id });
      return doc;
    }
    if (!nextRemoved) {
      await clearModerationIntent({ req, productId: doc.id });
      throw new Error(
        'Intent mismatch: actionType=removed but product isRemovedForPolicy is not true'
      );
    }
  }

  if (actionType === 'reinstated') {
    if (!prevRemoved && !nextRemoved) {
      await clearModerationIntent({ req, productId: doc.id });
      return doc;
    }
    if (nextRemoved) {
      await clearModerationIntent({ req, productId: doc.id });
      throw new Error(
        'Intent mismatch: actionType=reinstated but product isRemovedForPolicy is still true'
      );
    }
  }

  if (actionType === 'approved') {
    if (!prevFlagged && !nextFlagged) {
      await clearModerationIntent({ req, productId: doc.id });
      return doc;
    }
    if (nextFlagged) {
      await clearModerationIntent({ req, productId: doc.id });
      throw new Error(
        'Intent mismatch: actionType=approved but product isFlagged is still true'
      );
    }
  }

  // -----------------------------
  // Create audit row (append-only log)
  // -----------------------------
  let createdActionId: string | undefined;

  try {
    const created = await req.payload.create({
      collection: 'moderation-actions',
      overrideAccess: true,
      req,
      data: {
        product: doc.id,
        actionType,
        actor: user.id,
        actorEmailSnapshot: user.email,
        actorUsernameSnapshot: user.username,
        actorRoleSnapshot: user.roles,
        source: intent.source,
        ...(intent.actionType === 'approved' && intent.note
          ? { note: intent.note }
          : {}),
        ...(intent.actionType !== 'approved'
          ? { reason: intent.reason, note: intent.note }
          : {}),
        intentId: intent.intentId
      }
    });

    const maybeId = (created as unknown as { id?: unknown }).id;
    createdActionId = typeof maybeId === 'string' ? maybeId : undefined;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      // Clear marker so the product isn't stuck, then rethrow.
      await clearModerationIntent({ req, productId: doc.id });

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[Moderation Actions] Failed to create moderation action: ${message}`,
        { cause: error }
      );
    }

    const existing = await findModerationActionByIntentId({
      req,
      intentId: intent.intentId
    });

    createdActionId = existing?.id;

    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Moderation-Actions] duplicate intentId detected; action already recorded.'
      );
    }
  }

  // -----------------------------
  // Maintain latestRemovalSummary
  // -----------------------------
  if (actionType === 'removed') {
    await writeLatestRemovalSummary({
      req,
      productId: doc.id,
      summary: {
        actionId: createdActionId,
        intentId: intent.intentId,
        removedAt: intent.createdAt,
        reason: intent.reason,
        note: intent.note,
        source: intent.source,
        actorId: user.id,
        actorRoleSnapshot: Array.isArray(user.roles) ? [...user.roles] : [],
        actorEmailSnapshot: user.email ?? null,
        actorUsernameSnapshot: user.username ?? null
      }
    });
  }

  if (actionType === 'reinstated') {
    await clearLatestRemovalSummary({ req, productId: doc.id });
  }

  await clearModerationIntent({ req, productId: doc.id });

  return doc;
};
