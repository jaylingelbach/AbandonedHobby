import { headers as getHeaders } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { formatDate } from '@/lib/utils';
import { isNotFound } from '@/lib/server/utils';

// ─── Project Types ───────────────────────────────────────────────────────────
import { Product } from '@/payload-types';
import {
  ModerationInboxItem,
  ModerationRemovedItemDTO
} from '@/app/(app)/staff/moderation/types';

// ─── Project Constants ───────────────────────────────────────────────────────
import {
  flagReasonLabels,
  moderationFlagReasons,
  moderationReinstateReasons
} from '@/constants';

// ─── Project Functions ───────────────────────────────────────────────────────
import {
  isPopulatedTenant,
  resolveThumbnailUrl
} from '@/app/_api/(moderation)/inbox/utils';
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';

/**
 * Generate a new RFC 4122 version 4 UUID.
 *
 * @returns A UUID string conforming to RFC 4122 version 4.
 */
function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Normalizes an optional note by trimming whitespace and treating empty or non-string values as absent.
 *
 * @param value - The input note to normalize.
 * @returns The trimmed note if it contains characters, `undefined` otherwise.
 */
function normalizeOptionalNote(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validate and trim a required moderation note, enforcing a minimum length.
 *
 * @param value - The note text to validate and trim
 * @param minLength - Minimum allowed length in characters (defaults to 10)
 * @returns The trimmed note string
 * @throws TRPCError - `BAD_REQUEST` when the trimmed note is shorter than `minLength`
 */
function normalizeRequiredNote(value: string, minLength = 10): string {
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Note must be at least ${minLength} characters.`
    });
  }
  return trimmed;
}

/**
 * Verifies the caller is an authenticated staff user with either the `super-admin` or `support` role.
 *
 * @param user - The session user object; expected to have a `roles` array of strings.
 * @throws TRPCError with code `UNAUTHORIZED` if `user` is null or undefined.
 * @throws TRPCError with code `INTERNAL_SERVER_ERROR` if `user.roles` is missing or not an array of strings.
 * @throws TRPCError with code `FORBIDDEN` if `user.roles` does not include `super-admin` or `support`.
 */
function ensureStaff(
  user: { roles?: string[] | readonly string[] | null } | null
) {
  const roles = user?.roles;
  const isRoleArray =
    Array.isArray(roles) && roles.every((role) => typeof role === 'string');

  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication failed.'
    });
  }
  if (!isRoleArray) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'User roles are not available.'
    });
  }
  if (!(roles.includes('super-admin') || roles.includes('support'))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
  }
}

const defaultReason = moderationFlagReasons[0];

export const moderationRouter = createTRPCRouter({
  flagListing: baseProcedure
    .input(
      z.object({
        reason: z.enum(moderationFlagReasons),
        otherText: z.string().min(10).optional(),
        productId: z.string().min(1)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });
      const user = session?.user;

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication failed.'
        });
      }

      let product: Product;

      try {
        product = await ctx.db.findByID({
          collection: 'products',
          id: input.productId,
          overrideAccess: true
        });

        if (
          product.isArchived ||
          product.isRemovedForPolicy ||
          product.isFlagged === true
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Listing can not be flagged in its current state.`
          });
        }

        await ctx.db.update({
          collection: 'products',
          id: input.productId,
          overrideAccess: true,
          data: {
            isFlagged: true,
            flagReason: input.reason,
            flagReasonOtherText: input.otherText,
            flaggedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (isNotFound(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product with ID: ${input.productId} not found`
          });
        }
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            `[Moderation] there was a problem flagging productId: ${input.productId}`
          );
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while processing the request'
        });
      }

      return { ok: true };
    }),

  listInbox: protectedProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();
    const session = await ctx.db.auth({ headers });
    const user = session?.user;
    let moderationInboxItems: ModerationInboxItem[] = [];

    ensureStaff(user);

    try {
      const result = await ctx.db.find({
        collection: 'products',
        depth: 1,
        where: {
          and: [
            { isFlagged: { equals: true } },
            { isRemovedForPolicy: { not_equals: true } },
            { isArchived: { not_equals: true } }
          ]
        },
        limit: 50,
        sort: '-updatedAt'
      });

      moderationInboxItems = result.docs.map((product) => {
        const tenant = product.tenant;

        const tenantName = isPopulatedTenant(tenant) ? (tenant.name ?? '') : '';
        const tenantSlug = isPopulatedTenant(tenant) ? (tenant.slug ?? '') : '';

        const thumbnailUrl = resolveThumbnailUrl(product);

        return {
          id: product.id,
          productName: product.name,
          tenantName,
          tenantSlug,
          flagReason:
            product.flagReason &&
            moderationFlagReasons.includes(product.flagReason)
              ? product.flagReason
              : defaultReason,
          flagReasonLabel:
            product.flagReason && product.flagReason in flagReasonLabels
              ? flagReasonLabels[
                  product.flagReason as keyof typeof flagReasonLabels
                ]
              : 'Unknown',
          flagReasonOtherText: product.flagReasonOtherText ?? undefined,
          thumbnailUrl,
          reportedAt: product.flaggedAt ?? '',
          reportedAtLabel: formatDate(product.flaggedAt)
        };
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          `[Moderation] there was a problem getting inbox items:`,
          message
        );
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while processing the request'
      });
    }

    return { items: moderationInboxItems, ok: true };
  }),
  listRemoved: protectedProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();
    const session = await ctx.db.auth({ headers });
    const user = session?.user;
    let removedItems: ModerationRemovedItemDTO[] = [];

    ensureStaff(user);

    try {
      const result = await ctx.db.find({
        collection: 'products',
        depth: 1,
        where: {
          and: [
            { isFlagged: { equals: false } },
            { isRemovedForPolicy: { not_equals: false } },
            { isArchived: { not_equals: false } }
          ]
        },
        limit: 50,
        sort: '-updatedAt'
      });

      removedItems = result.docs.map((product) => {
        const tenant = product.tenant;

        const tenantName = isPopulatedTenant(tenant) ? (tenant.name ?? '') : '';
        const tenantSlug = isPopulatedTenant(tenant) ? (tenant.slug ?? '') : '';

        const thumbnailUrl = resolveThumbnailUrl(product);

        return {
          id: product.id,
          productName: product.name,
          tenantName,
          tenantSlug,
          flagReasonLabel:
            product.flagReason && product.flagReason in flagReasonLabels
              ? flagReasonLabels[
                  product.flagReason as keyof typeof flagReasonLabels
                ]
              : 'Unknown',

          flagReasonOtherText: product.flagReasonOtherText ?? undefined,
          thumbnailUrl,
          flaggedAt: product.flaggedAt ?? null,
          removedAt: product.removedAt ?? '',
          reportedAtLabel: formatDate(product.flaggedAt),

          removedAtLabel: formatDate(product.removedAt),

          reasonLabel:
            product.flagReason && product.flagReason in flagReasonLabels
              ? flagReasonLabels[
                  product.flagReason as keyof typeof flagReasonLabels
                ]
              : 'Unknown',
          note: product.moderationNote ?? undefined
        };
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          `[Moderation] there was a problem getting removed items:`,
          message
        );
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while processing the request'
      });
    }

    return { items: removedItems, ok: true };
  }),

  approveListing: protectedProcedure
    .input(
      z.object({
        note: z.string().min(1).optional(),
        productId: z.string().min(1)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });
      const user = session?.user;

      ensureStaff(user);

      const normalizedNote = normalizeOptionalNote(input.note);

      let product: Product;

      try {
        product = await ctx.db.findByID({
          collection: 'products',
          id: input.productId,
          overrideAccess: true
        });

        // If another moderation action is already in-flight, don't overwrite the marker.
        if (product.moderationIntent) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This listing already has a moderation action in progress.'
          });
        }

        // Idempotency: already cleared from inbox.
        if (
          product.isFlagged === false &&
          product.isRemovedForPolicy !== true
        ) {
          return { ok: true };
        }

        if (
          product.isArchived ||
          product.isRemovedForPolicy ||
          product.isFlagged === false
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Listing can not be unflagged in its current state.`
          });
        }

        await ctx.db.update({
          collection: 'products',
          id: input.productId,
          overrideAccess: true,
          user,
          data: {
            isFlagged: false,
            isRemovedForPolicy: false,
            approvedAt: new Date().toISOString(),
            moderationIntent: {
              source: 'staff_trpc',
              actionType: 'approved',
              createdAt: new Date().toISOString(),
              intentId: generateUuid(),
              ...(normalizedNote ? { note: normalizedNote } : {})
            }
          }
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (isNotFound(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product with ID: ${input.productId} not found`
          });
        }
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            `[Moderation] there was a problem unflagging productId: ${input.productId} with note: ${input.note}`
          );
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while processing the request'
        });
      }

      return { ok: true };
    }),

  removeListing: protectedProcedure
    .input(
      z.object({
        note: z.string().min(1),
        productId: z.string().min(1),
        reason: z.enum(moderationFlagReasons)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });
      const user = session?.user;

      ensureStaff(user);

      const normalizedNote = normalizeRequiredNote(input.note, 10);

      let product: Product;

      try {
        product = await ctx.db.findByID({
          collection: 'products',
          id: input.productId,
          overrideAccess: true
        });

        if (product.moderationIntent) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This listing already has a moderation action in progress.'
          });
        }

        // Idempotency: already removed.
        if (product.isRemovedForPolicy === true) {
          return { ok: true };
        }

        if (
          product.isArchived ||
          product.isRemovedForPolicy ||
          product.isFlagged === false
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Listing can not be removed in its current state.`
          });
        }

        await ctx.db.update({
          collection: 'products',
          id: input.productId,
          overrideAccess: true,
          user,
          data: {
            isArchived: true,
            isFlagged: false,
            isRemovedForPolicy: true,
            removedAt: new Date().toISOString(),
            moderationIntent: {
              source: 'staff_trpc',
              actionType: 'removed',
              createdAt: new Date().toISOString(),
              intentId: generateUuid(),
              reason: input.reason,
              note: normalizedNote
            }
          }
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (isNotFound(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product with ID: ${input.productId} not found`
          });
        }
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            `[Moderation] there was a problem removing productId: ${input.productId} with note: ${input.note}`
          );
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while processing the request'
        });
      }

      return { ok: true };
    }),

  reinstateListing: protectedProcedure
    .input(
      z.object({
        note: z.string().min(10),
        productId: z.string().min(1),
        reason: z.enum(moderationReinstateReasons)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });
      const user = session?.user;

      ensureStaff(user);

      const normalizedNote = normalizeRequiredNote(input.note, 10);

      let product: Product;

      try {
        product = await ctx.db.findByID({
          collection: 'products',
          id: input.productId,
          overrideAccess: true
        });

        if (product.moderationIntent) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This listing already has a moderation action in progress.'
          });
        }

        // Idempotency: already reinstated (not removed for policy).
        if (product.isRemovedForPolicy !== true) {
          return { ok: true };
        }

        if (!product.isArchived || !product.isRemovedForPolicy) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Listing can not be reinstated in its current state.`
          });
        }

        await ctx.db.update({
          collection: 'products',
          id: input.productId,
          overrideAccess: true,
          user,
          data: {
            isArchived: true,
            isFlagged: false,
            isRemovedForPolicy: false,
            reinstatedAt: new Date().toISOString(),
            moderationIntent: {
              source: 'staff_trpc',
              actionType: 'reinstated',
              createdAt: new Date().toISOString(),
              intentId: generateUuid(),
              reason: input.reason,
              note: normalizedNote
            }
          }
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (isNotFound(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product with ID: ${input.productId} not found`
          });
        }
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            `[Moderation] there was a problem reinstating productId: ${input.productId} with note: ${input.note}`
          );
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while processing the request'
        });
      }

      return { ok: true };
    })
});