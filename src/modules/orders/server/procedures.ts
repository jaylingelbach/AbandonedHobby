import z from 'zod';
import type { Order } from '@/payload-types';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { TRPCError } from '@trpc/server';

type OrderSummaryDTO = {
  orderId: string;
  orderNumber: string;
  orderDateISO: string; // createdAt
  returnsAcceptedThroughISO: string | null;
  currency: string;
  totalCents: number;
  quantity: number; // sum of item quantities
};

export const ordersRouter = createTRPCRouter({
  getLatestForProduct: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }): Promise<OrderSummaryDTO | null> => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const userId = ctx.session.user?.id;

      // Find the most recent order for this buyer & product
      const res = (await ctx.db.find({
        collection: 'orders',
        depth: 0,
        where: {
          and: [
            { buyer: { equals: userId } },
            { product: { equals: input.productId } } // uses your back-compat field
          ]
        },
        sort: '-createdAt',
        limit: 1
      })) as { docs: Order[]; totalDocs: number };

      if (res.totalDocs === 0) return null;

      const doc = res.docs[0];
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });
      // Sum item quantities (defaults to 1 if missing)
      const items = Array.isArray(doc.items) ? doc.items : [];
      const quantity = items.reduce<number>((sum, item) => {
        const q = typeof item.quantity === 'number' ? item.quantity : 1;
        return sum + q;
      }, 0);

      return {
        orderId: String(doc.id),
        orderNumber: doc.orderNumber,
        orderDateISO: doc.createdAt,
        returnsAcceptedThroughISO: doc.returnsAcceptedThrough ?? null,
        currency: doc.currency,
        totalCents: doc.total,
        quantity
      };
    })
});
