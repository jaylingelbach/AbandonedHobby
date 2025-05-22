import z from 'zod';
import { Media, Tenant } from '@/payload-types';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { DEFAULT_LIMIT } from '@/constants';

export const libraryRouter = createTRPCRouter({
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
      const products = await ctx.db.find({
        collection: 'products',
        pagination: false,
        where: { id: { in: productIds } }
      });

      /* ── 4. return the response as before ─────────────────────── */
      return {
        ...products,
        docs: products.docs.map((d) => ({
          ...d,
          image: d.image as Media | null,
          tenant: d.tenant as Tenant & { image: Media | null }
        }))
      };
    })
});
