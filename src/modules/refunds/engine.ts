import type { Payload } from 'payload';
import type { Stripe } from 'stripe';
import { stripe } from '@/lib/stripe';
import { LineSelection, EngineOptions, OrderWithTotals } from './types';
import {
  buildIdempotencyKey,
  computeRefundAmountCents,
  toLocalRefundStatus,
  toStripeRefundReason
} from './utils';
import { ExceedsRefundableError, FullyRefundedError } from './errors';

/**
 * Create and persist a Stripe refund for an order based on requested line selections and optional adjustments.
 *
 * @param orderId - ID of the order to refund
 * @param selections - Array of line selections describing which items and quantities to refund
 * @param options - Optional engine options (may include refundShippingCents, restockingFeeCents, reason, idempotencyKey, notes)
 * @returns An object containing the Stripe refund object (`refund`) and the created refund audit record (`record`)
 */

export async function createRefundForOrder(args: {
  payload: Payload;
  orderId: string;
  selections: LineSelection[];
  options?: EngineOptions;
}) {
  const { payload, orderId, selections, options } = args;

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('At least one selection is required');
  }

  // Keep the strong type (no `any`)
  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true
  })) as unknown as OrderWithTotals;

  if (!order?.id) throw new Error('Order not found');

  const accountId = order.stripeAccountId;
  if (!accountId)
    throw new Error('Order missing stripeAccountId for Connect refund.');

  const totalCents = typeof order.total === 'number' ? order.total : 0;
  const alreadyRefunded =
    typeof order.refundedTotalCents === 'number' ? order.refundedTotalCents : 0;

  const remainingRefundable = Math.max(0, totalCents - alreadyRefunded);

  if (remainingRefundable === 0) {
    throw new FullyRefundedError(order.id);
  }

  const piId = order.stripePaymentIntentId ?? null;
  const chargeId = order.stripeChargeId ?? null;
  if (!piId && !chargeId) {
    throw new Error('Order has no Stripe payment reference');
  }

  let refundAmount = computeRefundAmountCents(order, selections);
  if (typeof options?.refundShippingCents === 'number') {
    refundAmount += options.refundShippingCents;
  }
  if (typeof options?.restockingFeeCents === 'number') {
    refundAmount -= Math.max(0, options.restockingFeeCents);
  }
  if (refundAmount <= 0) {
    throw new Error(
      `Computed refund amount must be > 0 (got ${refundAmount} cents)`
    );
  }

  if (refundAmount > remainingRefundable) {
    throw new ExceedsRefundableError(
      order.id,
      refundAmount,
      remainingRefundable
    );
  }

  const idempotencyKey =
    options?.idempotencyKey ??
    buildIdempotencyKey(orderId, selections, options);

  // Validate all items exist before creating Stripe refund
  for (const sel of selections) {
    const item = (order.items ?? []).find((i) => i.id === sel.itemId);
    if (!item) {
      throw new Error(`Item ${sel.itemId} not found in order ${order.id}`);
    }
  }

  // Build metadata without `any`, and omit empty values
  const metadata: Stripe.MetadataParam = {
    orderId: order.id,
    ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
    selections: JSON.stringify(selections),
    ...(options?.reason ? { app_reason: options.reason } : {}),
    stripeAccountId: accountId
  };

  const stripeArgs: Stripe.RefundCreateParams = {
    amount: refundAmount,
    reason: toStripeRefundReason(options?.reason),
    ...(piId ? { payment_intent: piId } : { charge: chargeId! }),
    metadata
  };

  const refund = await stripe.refunds.create(stripeArgs, {
    idempotencyKey,
    stripeAccount: accountId
  });

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
      reason: options?.reason ?? undefined,
      selections: selections.map((sel) => {
        const src = (order.items ?? []).find((i) => i.id === sel.itemId);
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
