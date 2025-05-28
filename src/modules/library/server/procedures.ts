import z from 'zod';
import { Media, Tenant } from '@/payload-types';
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';
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
                equals: ctx.session.user.id
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
      /* ── 1. grab this user’s orders ─────────────────────────────── */
      const orders = await ctx.db.find({
        collection: 'orders',
        depth: 0,
        page: input.cursor,
        limit: input.limit,
        where: { user: { equals: ctx.session.user.id } }
      });

      /* ── 2. extract purchased product IDs ───────────────────────── */
      const productIds = orders.docs
        .map((o) => o.product) // adjust if your schema uses items[]
        .filter(Boolean);

      if (productIds.length === 0) {
        return { docs: [], nextPage: null, totalDocs: 0, totalPages: 0 };
      }

      /* ── 3. fetch the products themselves ───────────────────────── */
      try {
        const products = await ctx.db.find({
          collection: 'products',
          pagination: false,
          where: { id: { in: productIds } }
        });

        const dataWithSummaizedReviews = await Promise.all(
          products.docs.map(async (doc) => {
            const reviewsData = await ctx.db.find({
              collection: 'reviews',
              pagination: false, // load all
              where: {
                product: {
                  equals: doc.id
                }
              }
            });
            return {
              ...doc,
              reviewCount: reviewsData.totalDocs,
              reviewRating:
                reviewsData.docs.length === 0
                  ? 0
                  : reviewsData.docs.reduce(
                      (acc, review) => acc + review.rating,
                      0
                    ) / reviewsData.totalDocs
            };
          })
        );

        /* ── 4. return the response as before ─────────────────────── */
        return {
          ...products,
          docs: dataWithSummaizedReviews.map((doc) => ({
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
