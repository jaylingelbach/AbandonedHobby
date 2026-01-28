// ─── Node / Built-ins ────────────────────────────────────────────────────────
import { headers as getHeaders } from 'next/headers';

// ─── External Libraries ──────────────────────────────────────────────────────
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// ─── tRPC Setup ──────────────────────────────────────────────────────────────
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { formatDate } from '@/lib/utils';
import { isNotFound } from '@/lib/server/utils';

// ─── Project Types ───────────────────────────────────────────────────────────
import type { Product } from '@/payload-types';
import { ModerationRemovedItemDTO } from '@/app/(app)/staff/moderation/types';

// ─── Project Constants ───────────────────────────────────────────────────────
import {
  flagReasonLabels,
  moderationFlagReasons,
  moderationReinstateReasons
} from '@/constants';

// ─── Project Server Logic ────────────────────────────────────────────────────
import {
  ensureStaff,
  ensureSuperAdmin,
  generateUuid,
  isPopulatedTenant,
  normalizeOptionalNote,
  normalizeRequiredNote,
  resolveThumbnailUrl
} from '@/lib/server/moderation/utils';
import { isSuperAdmin } from '@/lib/access';

const defaultReason = moderationFlagReasons[0];

export const moderationRouter = createTRPCRouter({
  flagListing: protectedProcedure
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
          user,
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
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Moderation] flagListing failed', error);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while processing the request'
        });
      }

      return { ok: true };
    }),

  listInbox: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(50).optional()
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });
      const user = session?.user;

      ensureStaff(user);

      const page = input?.page ?? 1;
      const limit = input?.limit ?? 25;

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
          pagination: true,
          limit,
          page,
          sort: '-updatedAt'
        });

        const moderationInboxItems = result.docs.map((product) => {
          const tenant = product.tenant;

          const tenantName = isPopulatedTenant(tenant)
            ? (tenant.name ?? '')
            : '';
          const tenantSlug = isPopulatedTenant(tenant)
            ? (tenant.slug ?? '')
            : '';

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
        return {
          items: moderationInboxItems,
          ok: true,
          page: result.page,
          limit: result.limit,
          totalDocs: result.totalDocs,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        };
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
    }),
  listRemoved: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(50).optional()
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });
      const user = session?.user;
      ensureStaff(user);
      const canReinstate = isSuperAdmin(user);

      const page = input?.page ?? 1;
      const limit = input?.limit ?? 25;

      const toIsoString = (value: unknown): string | undefined => {
        if (typeof value === 'string' && value.length > 0) return value;
        if (value instanceof Date) return value.toISOString();
        return undefined;
      };

      try {
        const result = await ctx.db.find({
          collection: 'products',
          depth: 1,
          where: {
            and: [
              { isFlagged: { equals: false } },
              { isRemovedForPolicy: { equals: true } },
              { isArchived: { equals: true } }
            ]
          },
          pagination: true,
          limit,
          page,
          sort: '-updatedAt'
        });

        const productRows = result.docs.map((product) => {
          const tenant = product.tenant;
          const tenantName = isPopulatedTenant(tenant)
            ? (tenant.name ?? '')
            : '';
          const tenantSlug = isPopulatedTenant(tenant)
            ? (tenant.slug ?? '')
            : '';

          return {
            product,
            tenantName,
            tenantSlug,
            thumbnailUrl: resolveThumbnailUrl(product)
          };
        });

        const productIds = productRows.map((row) => row.product.id);

        // Always return pagination meta (even if empty)
        if (productIds.length === 0) {
          return {
            items: [],
            ok: true,
            page: result.page,
            limit: result.limit,
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
            canReinstate
          };
        }

        const removedItems: ModerationRemovedItemDTO[] = productRows.map(
          (row) => {
            const product = row.product;
            const latestAction = product.latestRemovalSummary;

            const removedAtIso =
              toIsoString(latestAction?.removedAt) ??
              toIsoString(product.removedAt) ??
              '';

            const enforcementReason = product.latestRemovalSummary?.reason;

            const enforcementReasonLabel =
              enforcementReason && enforcementReason in flagReasonLabels
                ? flagReasonLabels[
                    enforcementReason as keyof typeof flagReasonLabels
                  ]
                : (enforcementReason ?? 'Unknown');

            const note =
              typeof latestAction?.note === 'string' &&
              latestAction.note.trim().length > 0
                ? (product.latestRemovalSummary?.note ?? undefined)
                : undefined;

            return {
              id: product.id,
              productName: product.name,
              tenantName: row.tenantName,
              tenantSlug: row.tenantSlug,
              thumbnailUrl: row.thumbnailUrl,

              // reporter context (product-based)
              flagReasonOtherText: product.flagReasonOtherText ?? undefined,
              reportedAtLabel: product.flaggedAt
                ? formatDate(product.flaggedAt)
                : undefined,

              // enforcement context (action-based)
              removedAt: removedAtIso,
              removedAtLabel: formatDate(removedAtIso),
              enforcementReasonLabel: enforcementReasonLabel,
              note,

              actionId: latestAction?.actionId ?? undefined,
              intentId: latestAction?.intentId ?? undefined
            };
          }
        );

        return {
          items: removedItems,
          ok: true,
          page: result.page,
          limit: result.limit,
          canReinstate,
          totalDocs: result.totalDocs,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        };
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

      ensureSuperAdmin(user);

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

        // Idempotency: already reinstated (i.e. not removed for policy anymore).
        // NOTE: "reinstated" does NOT mean "live" — it just clears the policy removal.
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
            // Intentional invariant:
            // Reinstatement clears policy removal but keeps the listing archived,
            // so it does NOT go live automatically. Seller must explicitly relist / unarchive
            // through the normal flow (inventory + archive toggle).
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
