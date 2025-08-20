import z from 'zod';
import { Media, Tenant } from '@/payload-types';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { DEFAULT_LIMIT } from '@/constants';
import { TRPCError } from '@trpc/server';

export const libraryRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        productId: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      /* ── 1. grab this user’s orders ─────────────────────────────── */
      const ordersData = await ctx.db.find({
        collection: 'orders',
        limit: 1,
        pagination: false,
        where: {
          and: [
            {
              product: {
                equals: input.productId
              }
            },
            {
              user: {
                equals: user.id
              }
            }
          ]
        }
      });

      /* ── 2. extract order ───────────────────────── */
      const order = ordersData.docs[0];
      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No order found'
        });
      }

      /* ── 3. fetch the product  ───────────────────────── */
      try {
        const product = await ctx.db.findByID({
          collection: 'products',
          id: input.productId
        });

        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Product not found'
          });
        }

        /* ── 4. return the product ─────────────────────── */
        return product;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch library products',
          cause: error
        });
      }
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT)
      })
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      /* ── Grab this user’s orders ─────────────────────────────── */
      const orders = await ctx.db.find({
        collection: 'orders',
        depth: 0,
        page: input.cursor,
        limit: input.limit,
        where: { user: { equals: user.id } }
      });

      /* ── Extract purchased product IDs ───────────────────────── */
      const productIds = orders.docs
        .map((o) => o.product) // adjust if your schema uses items[]
        .filter(Boolean);

      if (productIds.length === 0) {
        return { docs: [], nextPage: null, totalDocs: 0, totalPages: 0 };
      }

      /* ── Fetch the products themselves ───────────────────────── */
      try {
        const products = await ctx.db.find({
          collection: 'products',
          pagination: false,
          where: { id: { in: productIds } }
        });

        // Fetch all reviews for these product IDs in a single query
        const allReviews = await ctx.db.find({
          collection: 'reviews',
          pagination: false,
          depth: 0,
          where: {
            product: { in: productIds }
          }
        });

        // Group reviews by product ID
        const reviewsByProduct = new Map<
          string,
          { count: number; totalRating: number }
        >();

        for (const review of allReviews.docs) {
          const productId =
            typeof review.product === 'string'
              ? review.product
              : review.product.id;
          if (!reviewsByProduct.has(productId)) {
            reviewsByProduct.set(productId, { count: 0, totalRating: 0 });
          }
          const entry = reviewsByProduct.get(productId)!;
          entry.count += 1;
          entry.totalRating += review.rating;
        }

        // Merge data into product docs
        const dataWithSummarizedReviews = products.docs.map((doc) => {
          const reviewStats = reviewsByProduct.get(doc.id) ?? {
            count: 0,
            totalRating: 0
          };
          return {
            ...doc,
            reviewCount: reviewStats.count,
            reviewRating:
              reviewStats.count === 0
                ? 0
                : reviewStats.totalRating / reviewStats.count
          };
        });

        /* ── Return the response ─────────────────────── */
        return {
          ...products,
          docs: dataWithSummarizedReviews.map((doc) => ({
            ...doc,
            image: doc.image as Media | null,
            tenant: doc.tenant as Tenant & { image: Media | null }
          }))
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch library products',
          cause: error
        });
      }
    })
});
