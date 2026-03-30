import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { getRelId, getTenantId } from '@/lib/server/utils';
import { getTenantIdsFromUser } from '@/payload/views/utils';

export const reviewsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({ productId: z.string() }))
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

      const reviewsData = await ctx.db.find({
        collection: 'reviews',
        limit: 1,
        where: {
          and: [
            { tenant: { equals: sellerTenantId } },
            { user: { equals: user.id } }
          ]
        }
      });

      return reviewsData.docs[0] ?? null;
    }),

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
      const id = ctx.session?.user?.id;
      if (!id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No ID found for user'
        });
      }

      const user = await ctx.db.findByID({
        collection: 'users',
        id
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

      // 1) Ensure this user has an order for the product (handles legacy + items[])
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
          message: 'The order must belong to you' // rework message?
        });
      }
      const hasOrder = getRelId(orderRes?.product ?? null) === product.id;

      if (!hasOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No order found' });
      }

      // Ensure buyer is not the seller
      const buyerTenantIds = getTenantIdsFromUser(user);
      const sellerTenantId = getTenantId(product.tenant);

      if (buyerTenantIds?.includes(sellerTenantId)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot review your own shop'
        });
      }

      // Optional UX pre-check (not sufficient against races, but keeps messages friendly)
      const existing = await ctx.db.find({
        collection: 'reviews',
        limit: 1,
        where: {
          and: [
            { tenant: { equals: sellerTenantId } },
            { user: { equals: user.id } }
          ]
        }
      });
      if (existing.totalDocs > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have already left a review for this product'
        });
      }

      const fulfillmentStatus = orderRes.fulfillmentStatus;

      if (fulfillmentStatus !== 'delivered') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You can only leave a review after delivery'
        });
      }
      // Real protection is the unique index + this try/catch
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
            message: 'You have already left a review for this product'
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create review'
        });
      }
    }),

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
        depth: 0, // existingReview.user === id
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
