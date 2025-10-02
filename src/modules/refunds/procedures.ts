import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createRefundForOrder } from '@/modules/refunds/engine';
import { buildIdempotencyKeyV2 } from './utils';

const lineSelectionSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive()
});

export const refundsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        selections: z.array(lineSelectionSchema).min(1),
        reason: z
          .enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other'])
          .optional(),
        restockingFeeCents: z.number().int().nonnegative().optional(),
        refundShippingCents: z.number().int().nonnegative().optional(),
        notes: z.string().max(1000).optional(),
        idempotencyKey: z.string().trim().min(1).max(128).optional()
      })
    )
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const refundsRouter = createTRPCRouter({
  // … other procedures …

  refundMutation: protectedProcedure
    .input(/* … */)
    .mutation(async ({ ctx, input }) => {
      // Require staff/admin
      const roles = Array.isArray(ctx.session.user?.roles)
        ? ctx.session.user!.roles
        : [];
      const isStaff = roles.includes('super-admin');
      if (!isStaff) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
      }

      // … rest of mutation logic …
    }),
});
      const payload = await getPayload({ config });

      const idempotencyKey =
        input.idempotencyKey ??
        buildIdempotencyKeyV2({
          orderId: input.orderId,
          selections: input.selections,
          options: {
            reason: input.reason,
            restockingFeeCents: input.restockingFeeCents,
            refundShippingCents: input.refundShippingCents
            // we intentionally omit `notes` from the key
          }
        });

      const { refund, record } = await createRefundForOrder({
        payload,
        orderId: input.orderId,
        selections: input.selections,
        options: {
          reason: input.reason,
          restockingFeeCents: input.restockingFeeCents,
          refundShippingCents: input.refundShippingCents,
          notes: input.notes,
          idempotencyKey
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
