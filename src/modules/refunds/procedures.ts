import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createRefundForOrder } from '@/modules/refunds/engine';
import { TRPCError } from '@trpc/server';
import { refundRequestSchema } from '@/app/api/admin/refunds/schema';

export const refundsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(refundRequestSchema)
    .mutation(async ({ ctx, input }) => {
      // Require staff/admin
      const roles = Array.isArray(ctx.session.user?.roles)
        ? ctx.session.user!.roles
        : [];
      const isStaff = roles.includes('super-admin');
      if (!isStaff)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden' });

      const payload = await getPayload({ config });

      const { refund, record } = await createRefundForOrder({
        payload,
        orderId: input.orderId,
        selections: input.selections,
        options: {
          reason: input.reason,
          restockingFeeCents: input.restockingFeeCents,
          refundShippingCents: input.refundShippingCents,
          notes: input.notes
        }
      });

      return {
        ok: true,
        stripeRefundId: refund.id,
        status: refund.status,
        amount: refund.amount,
        refundId: record.id
      };
    })
});
