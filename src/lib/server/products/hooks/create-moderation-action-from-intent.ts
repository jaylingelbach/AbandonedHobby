import { z } from 'zod';

import { isStaff, isSuperAdmin } from '@/lib/access';
import type { Product, User } from '@/payload-types';
import { CollectionAfterChangeHook } from 'payload';
import { TRPCError } from '@trpc/server';
import { moderationIntentReasons, moderationSelectOptions } from '@/constants';

const moderationIntentSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('approved'),
    source: z.enum(moderationIntentReasons),
    note: z.string().min(1).optional(),
    createdAt: z.string().min(1)
  }),
  z.object({
    actionType: z.literal('removed'),
    source: z.enum(moderationIntentReasons),
    reason: z.enum(moderationSelectOptions),
    note: z.string().min(1),
    createdAt: z.string().min(1)
  }),
  z.object({
    actionType: z.literal('reinstated'),
    source: z.enum(moderationIntentReasons),
    reason: z.enum(moderationSelectOptions),
    note: z.string().min(1),
    createdAt: z.string().min(1)
  })
]);

function isUserRoleArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function assertStaffUser(user: User | null): asserts user is User {
  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated'
    });
  }
  if (!isUserRoleArray(user.roles)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'User roles are not available'
    });
  }
  if (!(isSuperAdmin(user) || isStaff(user))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Forbidden'
    });
  }
}

type HookContext = {
  skipModerationIntentHook?: boolean;
};

/**
 * After-change hook for Products:
 * - If `moderationIntent` is present, create a ModerationAction audit row.
 * - Then clear `moderationIntent` (with a recursion guard).
 */
export const createModerationActionFromIntent: CollectionAfterChangeHook<
  Product
> = async ({ doc, req }) => {
  const user = req.user;
  if (!user)
    throw new TRPCError({
      code: 'UNAUTHORIZED'
    });
  const context = (req.context ?? {}) as HookContext;

  // Recursion guard: our own "clear intent" update will re-trigger hooks.
  if (context.skipModerationIntentHook) {
    return doc;
  }

  const maybeIntent: unknown = (
    doc as unknown as { moderationIntent?: unknown }
  ).moderationIntent;

  if (!maybeIntent) {
    return doc;
  }

  const parsed = moderationIntentSchema.safeParse(maybeIntent);
  if (!parsed.success) {
    // Fail loudly: intent markers should always be well-formed
    throw new Error(
      `Invalid moderationIntent: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    );
  }

  const intent = parsed.data;

  // For system-generated intents, you can choose whether to allow no-user.
  // Today: enforce authenticated staff to create an audit row.
  assertStaffUser(req.user as User | null);

  // Optional sanity checks (prevents stale/incorrect intents)
  if (intent.actionType === 'removed') {
    if (doc.isRemovedForPolicy !== true) {
      throw new Error(
        'Intent mismatch: removed but product isRemovedForPolicy is not true'
      );
    }
  }
  if (intent.actionType === 'reinstated') {
    if (doc.isRemovedForPolicy === true) {
      throw new Error(
        'Intent mismatch: reinstated but product isRemovedForPolicy is still true'
      );
    }
  }

  // Create audit row (append-only log)
  await req.payload.create({
    collection: 'moderation-actions',
    data: {
      product: doc.id,
      actionType: intent.actionType,
      actor: user.id,
      actorEmailSnapshot: user.email,
      actorUsernameSnapshot: user.username,
      actorRoleSnapshot: user.roles,
      source: intent.source
    },
    overrideAccess: true,
    req
  });

  // Clear the intent marker (and avoid re-triggering this hook)
  req.context = {
    ...(req.context ?? {}),
    skipModerationIntentHook: true
  } satisfies HookContext;

  await req.payload.update({
    collection: 'products',
    id: doc.id,
    data: {
      moderationIntent: undefined
    },
    overrideAccess: true,
    req
  });

  return doc;
};
