import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { getRelId, getTenantId } from '@/lib/server/utils';
import { getTenantIdsFromUser } from '@/payload/views/utils';

export const reviewsRouter = createTRPCRouter({
  /**
   * Get a single review for a product in a specific order
   */
  getOne: protectedProcedure
    .input(z.object({ productId: z.string(), orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const product = await ctx.db.findByID({
        collection: 'products',
        id: input.productId
      });

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Product not found with id of ${input.productId}`
        });
      }

      const sellerTenantId = getTenantId(product.tenant);

      // Product-scoped lookup prevents cross-product leakage
      const reviewsData = await ctx.db.find({
        collection: 'reviews',
        limit: 1,
        where: {
          and: [
            { tenant: { equals: sellerTenantId } },
            { user: { equals: user.id } },
            { order: { equals: input.orderId } },
            { product: { equals: product.id } } // product filter added
          ]
        }
      });

      return reviewsData.docs[0] ?? null;
    }),

  /**
   * Create a review for a product in a specific order
   */
  create: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        rating: z
          .number()
          .int()
          .min(1, { message: 'Rating is required.' })
          .max(5),
        description: z.string().min(3, { message: 'Description is required.' }),
        orderId: z.string().min(1)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No ID found for user'
        });
      }

      const user = await ctx.db.findByID({
        collection: 'users',
        id: userId
      });
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const product = await ctx.db.findByID({
        collection: 'products',
        id: input.productId
      });
      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Product not found with id of ${input.productId}`
        });
      }

      const orderRes = await ctx.db.findByID({
        collection: 'orders',
        id: input.orderId
      });
      if (!orderRes) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Order not found with the id of ${input.orderId}`
        });
      }

      if (getRelId(orderRes.buyer) !== user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'The order must belong to you'
        });
      }

      // Multi-item check
      let hasOrder = false;
      if (Array.isArray(orderRes.items)) {
        hasOrder = orderRes.items.some((item, index) => {
          if (!item.product) {
            console.warn(
              `Order ${orderRes.id} has an item at index ${index} missing a product reference`
            );
            return false;
          }
          return getRelId(item.product) === product.id;
        });
      }

      // Legacy single-product fallback
      if (!hasOrder && orderRes.product) {
        hasOrder = getRelId(orderRes.product) === product.id;
      }

      if (!hasOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No order found containing this product'
        });
      }

      const buyerTenantIds = getTenantIdsFromUser(user);
      const sellerTenantId = getTenantId(product.tenant);
      if (buyerTenantIds?.includes(sellerTenantId)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot review your own shop'
        });
      }

      // Pre-check for existing review (per order)
      const existing = await ctx.db.find({
        collection: 'reviews',
        limit: 1,
        where: {
          and: [
            { order: { equals: input.orderId } },
            { user: { equals: user.id } },
            { product: { equals: product.id } } // ensure per-product
          ]
        }
      });
      if (existing.totalDocs > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have already left a review for this order'
        });
      }

      const fulfillmentStatus = orderRes.fulfillmentStatus;
      if (fulfillmentStatus !== 'delivered') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You can only leave a review after delivery'
        });
      }

      try {
        const review = await ctx.db.create({
          collection: 'reviews',
          data: {
            user: user.id,
            rating: input.rating,
            description: input.description,
            order: input.orderId,
            tenant: sellerTenantId,
            product: product.id
          }
        });
        return review;
      } catch (err) {
        const e = err as { code?: number | string; message?: string };
        const isMongoDup =
          e?.code === 11000 ||
          (typeof e?.message === 'string' && e.message.includes('E11000'));
        const isPostgresDup =
          e?.code === '23505' ||
          (typeof e?.message === 'string' && /duplicate key/i.test(e.message));

        if (isMongoDup || isPostgresDup) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You have already left a review for this order'
          });
        }

        console.error('Failed to create review:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create review'
        });
      }
    }),

  /**
   * Update an existing review
   */
  update: protectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        rating: z
          .number()
          .int()
          .min(1, { message: 'Rating is required.' })
          .max(5),
        description: z.string().min(3, { message: 'Description is required.' })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const existingReview = await ctx.db.findByID({
        collection: 'reviews',
        depth: 0,
        id: input.reviewId
      });

      if (!existingReview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Review not found with id of ${input.reviewId}`
        });
      }

      if (existingReview.user !== user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not allowed to update this review'
        });
      }

      const updatedReview = await ctx.db.update({
        collection: 'reviews',
        id: input.reviewId,
        data: {
          rating: input.rating,
          description: input.description
        }
      });
      return updatedReview;
    })
});
