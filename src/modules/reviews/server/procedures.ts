import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

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

      const reviewsData = await ctx.db.find({
        collection: 'reviews',
        limit: 1,
        where: {
          and: [
            { product: { equals: input.productId } },
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
        description: z.string().min(3, { message: 'Description is required.' })
      })
    )
    .mutation(async ({ input, ctx }) => {
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

      // Optional UX pre-check (not sufficient against races, but keeps messages friendly)
      const existing = await ctx.db.find({
        collection: 'reviews',
        limit: 1,
        where: {
          and: [
            { product: { equals: input.productId } },
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

      // Real protection is the unique index + this try/catch
      try {
        const review = await ctx.db.create({
          collection: 'reviews',
          data: {
            user: user.id,
            product: product.id,
            rating: input.rating,
            description: input.description
          }
        });
        return review;
      } catch (err) {
        const e = err as { code?: number | string; message?: string };

        // Mongo duplicate key (E11000) or Postgres unique violation (23505)
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

        // Unknown error -> bubble up as 500
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
