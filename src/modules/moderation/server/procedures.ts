import { z } from 'zod';
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';
import { headers as getHeaders } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { Product } from '@/payload-types';
import { isNotFound } from '@/lib/server/utils';
import { ModerationInboxItem } from '@/app/(app)/staff/moderation/types';
import {
  flagReasonLabels,
  moderationFlagReasons,
  moderationReinstateReasons
} from '@/constants';
import {
  isPopulatedTenant,
  resolveThumbnailUrl
} from '@/app/_api/(moderation)/inbox/utils';

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

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication failed.'
      });
    }

    if (
      !(user.roles?.includes('super-admin') || user.roles?.includes('support'))
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Not authorized'
      });
    }
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
          flagReasonLabel:
            product.flagReason && product.flagReason in flagReasonLabels
              ? flagReasonLabels[
                  product.flagReason as keyof typeof flagReasonLabels
                ]
              : 'Unknown',
          flagReasonOtherText: product.flagReasonOtherText ?? undefined,
          thumbnailUrl,
          flaggedAt: product.flaggedAt ?? '',
          reportedAtLabel: product.flaggedAt
            ? new Date(product.flaggedAt).toLocaleDateString()
            : ''
        };
      });
    } catch (error) {
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
  approveListing: protectedProcedure
    .input(
      z.object({
        note: z.string().min(1),
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

      if (
        !(
          user.roles?.includes('super-admin') || user.roles?.includes('support')
        )
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized'
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
          data: {
            isFlagged: false,
            isRemovedForPolicy: false,
            approvedAt: new Date().toISOString()
          }
        });
      } catch (error) {
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

      if (
        !(
          user.roles?.includes('super-admin') || user.roles?.includes('support')
        )
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized'
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
          data: {
            isArchived: true,
            isFlagged: false,
            isRemovedForPolicy: true,
            removedAt: new Date().toISOString()
          }
        });
      } catch (error) {
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
        note: z.string().min(1),
        productId: z.string().min(1),
        reason: z.enum(moderationReinstateReasons)
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

      if (
        !(
          user.roles?.includes('super-admin') || user.roles?.includes('support')
        )
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized'
        });
      }
      let product: Product;
      try {
        product = await ctx.db.findByID({
          collection: 'products',
          id: input.productId,
          overrideAccess: true
        });
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
          data: {
            isArchived: true,
            isFlagged: false,
            isRemovedForPolicy: false,
            reinstatedAt: new Date().toISOString()
          }
        });
      } catch (error) {
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
