import { z } from 'zod';

import type { CollectionAfterChangeHook, PayloadRequest } from 'payload';

import { isStaff, isSuperAdmin } from '@/lib/access';
import type { Product, User } from '@/payload-types';
import { moderationSource, moderationSelectOptions } from '@/constants';
import { isUniqueViolation } from '@/lib/server/errors/errors';

const moderationIntentSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('approved'),
    source: z.enum(moderationSource),
    note: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    intentId: z.string().uuid()
  }),
  z.object({
    actionType: z.literal('removed'),
    source: z.enum(moderationSource),
    reason: z.enum(moderationSelectOptions),
    note: z.string().min(1),
    createdAt: z.string().min(1),
    intentId: z.string().uuid()
  }),
  z.object({
    actionType: z.literal('reinstated'),
    source: z.enum(moderationSource),
    reason: z.enum(moderationSelectOptions),
    note: z.string().min(1),
    createdAt: z.string().min(1),
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

type HookContext = {
  skipModerationIntentHook?: boolean;
  skipSideEffects?: boolean;
};

async function clearModerationIntent(params: {
  req: PayloadRequest;
  productId: string;
}): Promise<void> {
  const { req, productId } = params;

  const nextContext = {
    ...(req.context ?? {}),
    skipModerationIntentHook: true,
    skipSideEffects: true
  } satisfies HookContext;

  req.context = nextContext as unknown as PayloadRequest['context'];

  await req.payload.update({
    collection: 'products',
    id: productId,
    data: { moderationIntent: undefined },
    overrideAccess: true,
    req
  });
}

/**
 * After-change hook for Products:
 * - If `moderationIntent` is present, create a ModerationAction audit row.
 * - Then clear `moderationIntent` (with a recursion guard).
 *
 * Idempotency:
 * - ModerationActions.intentId is unique.
 * - If a duplicate intentId is detected, treat it as "already written" and proceed to clear the marker.
 *
 * Transition checks:
 * - We validate using previousDoc -> doc, because doc alone cannot tell if this was already done.
 */
export const createModerationActionFromIntent: CollectionAfterChangeHook<
  Product
> = async ({ doc, req, previousDoc }) => {
  const user = req.user as User | null;
  if (!user) throw new Error('Not authenticated');

  const context = (req.context ?? {}) as HookContext;

  // Recursion / internal-cleanup guard:
  // our "clear intent" update will re-trigger product hooks, but should do no side effects.
  if (context.skipModerationIntentHook || context.skipSideEffects) {
    return doc;
  }

  const maybeIntent: unknown = (
    doc as unknown as { moderationIntent?: unknown }
  ).moderationIntent;

  if (!maybeIntent) return doc;

  const parsed = moderationIntentSchema.safeParse(maybeIntent);
  if (!parsed.success) {
    throw new Error(
      `Invalid moderationIntent: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    );
  }

  const intent = parsed.data;

  // Enforce authenticated staff to create an audit row.
  assertStaffUser(user);

  // Previous-state values (defensive: previousDoc can be undefined in some operations)
  const prevRemoved = Boolean(previousDoc?.isRemovedForPolicy);
  const nextRemoved = Boolean(doc.isRemovedForPolicy);

  const prevFlagged = Boolean(previousDoc?.isFlagged);
  const nextFlagged = Boolean(doc.isFlagged);

  // -----------------------------
  // Transition sanity checks
  // -----------------------------
  if (intent.actionType === 'removed') {
    // Ideal: false -> true
    if (prevRemoved && nextRemoved) {
      // Already removed; treat as idempotent success: clear marker and exit.
      await clearModerationIntent({ req, productId: doc.id });
      return doc;
    }

    if (!nextRemoved) {
      throw new Error(
        'Intent mismatch: actionType=removed but product isRemovedForPolicy is not true'
      );
    }
  }

  if (intent.actionType === 'reinstated') {
    // Ideal: true -> false
    if (!prevRemoved && !nextRemoved) {
      // Already reinstated (or never removed); treat as idempotent success: clear marker and exit.
      await clearModerationIntent({ req, productId: doc.id });
      return doc;
    }

    if (nextRemoved) {
      throw new Error(
        'Intent mismatch: actionType=reinstated but product isRemovedForPolicy is still true'
      );
    }
  }

  if (intent.actionType === 'approved') {
    // Ideal: true -> false
    if (!prevFlagged && !nextFlagged) {
      // Already cleared from inbox; treat as idempotent success.
      await clearModerationIntent({ req, productId: doc.id });
      return doc;
    }

    if (nextFlagged) {
      // Regardless of previous value, if it's still flagged after this write, intent didn't apply.
      throw new Error(
        'Intent mismatch: actionType=approved but product isFlagged is still true'
      );
    }
  }

  // -----------------------------
  // Create audit row (append-only log)
  // -----------------------------
  try {
    await req.payload.create({
      collection: 'moderation-actions',
      data: {
        product: doc.id,
        actionType: intent.actionType,
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
      },
      overrideAccess: true,
      req
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[Moderation Actions] Failed to create moderation action: ${message}`,
        { cause: error }
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Moderation-Actions] duplicate intentId detected; action already recorded.'
      );
    }
  }

  // Always clear marker at the end (and suppress side effects on the cleanup write).
  await clearModerationIntent({ req, productId: doc.id });

  return doc;
};
