import type { Payload } from 'payload';
import type { Stripe } from 'stripe';
import { stripe } from '@/lib/stripe';
import { LineSelection, EngineOptions, OrderLike } from './types';
import {
  buildIdempotencyKey,
  computeRefundAmountCents,
  toLocalRefundStatus,
  toStripeRefundReason
} from './utils';

/**
 * Compute the refundable amount for the requested selections.
 * Strategy:
 *  - For each selected item/qty:
 *      * unitTotal = (amountTotal ?? unitAmount*qtyOriginal)/qtyOriginal
 *      * perUnitTax = (amountTax ?? 0)/qtyOriginal
 *      * refundCents += round(unitTotal * qtySelected)
 *  - Then apply optional fees/adjustments.
 *
 * This keeps taxes and discounts proportional to what was captured.
 */

export async function createRefundForOrder(args: {
  payload: Payload;
  orderId: string;
  selections: LineSelection[]; // items and quantities to refund
  options?: EngineOptions;
}) {
  const { payload, orderId, selections, options } = args;

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('At least one selection is required');
  }

  // Load order (no depth needed)
  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true
  })) as unknown as OrderLike;

  if (!order?.id) throw new Error('Order not found');
  const piId = order.stripePaymentIntentId ?? null;
  const chargeId = order.stripeChargeId ?? null;
  if (!piId && !chargeId) {
    throw new Error('Order has no Stripe payment reference');
  }

  const accountId = order.stripeAccountId;
  if (!accountId) throw new Error('Order is missing stripeAccountId');

  // Compute base amount
  let refundAmount = computeRefundAmountCents(order, selections);

  // Optional adjustments
  if (typeof options?.refundShippingCents === 'number') {
    refundAmount += options.refundShippingCents;
  }
  if (typeof options?.restockingFeeCents === 'number') {
    refundAmount -= Math.max(0, options.restockingFeeCents);
  }

  if (refundAmount <= 0) {
    throw new Error('Computed refund amount must be > 0');
  }

  // Idempotency
  const idempotencyKey =
    options?.idempotencyKey ??
    buildIdempotencyKey(orderId, selections, options);

  // Make the Stripe refund
  const appReason = options?.reason;

  const stripeArgs: Stripe.RefundCreateParams = {
    amount: refundAmount,
    reason: toStripeRefundReason(appReason),
    ...(piId ? { payment_intent: piId } : { charge: chargeId! }),
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      selections: JSON.stringify(selections),
      app_reason: appReason ?? '' // preserves 'other' for your own records
    }
  };

  console.log('[refund] creating', {
    accountId,
    payment_intent: piId,
    charge: chargeId,
    amount: refundAmount
  });
  const refund = await stripe.refunds.create(stripeArgs, {
    stripeAccount: accountId,
    idempotencyKey
  });

  // Persist refund record (audit log)
  const created = await payload.create({
    collection: 'refunds',
    data: {
      order: order.id,
      orderNumber: order.orderNumber,
      stripeRefundId: refund.id,
      stripePaymentIntentId: piId ?? undefined,
      stripeChargeId: chargeId ?? undefined,
      amount: refundAmount,
      status: toLocalRefundStatus(refund.status),
      reason: appReason ?? undefined,
      selections: selections.map((sel) => {
        const src = (order.items ?? []).find((i) => i.id === sel.itemId);
        if (!src) {
          // This should never happen as computeRefundAmountCents validates items
          console.warn(`[refund] Item ${sel.itemId} not found during snapshot`);
        }
        return {
          itemId: sel.itemId,
          quantity: sel.quantity,
          unitAmount: typeof src?.unitAmount === 'number' ? src.unitAmount : 0,
          amountTotal:
            typeof src?.amountTotal === 'number' ? src.amountTotal : 0
        };
      }),
      fees: {
        restockingFeeCents: options?.restockingFeeCents ?? undefined,
        refundShippingCents: options?.refundShippingCents ?? undefined
      },
      notes: options?.notes ?? undefined,
      idempotencyKey
    },
    overrideAccess: true
  });
  return { refund, record: created };
}
