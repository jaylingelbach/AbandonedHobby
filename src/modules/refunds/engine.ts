import type { Payload } from 'payload';
import type { Stripe } from 'stripe';
import { stripe } from '@/lib/stripe';

import type { Refund } from '@/payload-types';
import type {
  EngineOptions,
  OrderWithTotals,
  LineSelection,
  LineSelectionQty,
  LineSelectionAmount
} from './types';
import {
  buildIdempotencyKeyV2,
  computeRefundAmountCents,
  toLocalRefundStatus,
  toStripeRefundReason
} from './utils';
import { ExceedsRefundableError, FullyRefundedError } from './errors';

/** Blocks persisted to the `refunds` collection */
type SelectionBlockQuantity = {
  blockType: 'quantity';
  itemId: string;
  quantity: number;
  unitAmount?: number;
  amountTotal?: number;
};

type SelectionBlockAmount = {
  blockType: 'amount';
  itemId: string;
  amountCents: number;
};

type SelectionBlock = SelectionBlockQuantity | SelectionBlockAmount;

function isQuantitySelection(sel: LineSelection): sel is LineSelectionQty {
  return 'quantity' in sel && typeof sel.quantity === 'number';
}

function isAmountSelection(sel: LineSelection): sel is LineSelectionAmount {
  return 'amountCents' in sel && typeof sel.amountCents === 'number';
}

function assertNever(value: never): never {
  throw new Error(`Unsupported selection shape: ${JSON.stringify(value)}`);
}

/**
 * Create and persist a Stripe refund for an order based on requested line selections and optional adjustments.
 */
export async function createRefundForOrder(args: {
  payload: Payload;
  orderId: string;
  selections: LineSelection[];
  options?: EngineOptions;
}): Promise<{ refund: Stripe.Refund; record: Refund }> {
  const { payload, orderId, selections, options } = args;

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('At least one selection is required');
  }

  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true
  })) as unknown as OrderWithTotals;

  if (!order?.id) {
    throw new Error('Order not found');
  }

  const stripeAccountId = order.stripeAccountId;
  if (!stripeAccountId) {
    throw new Error('Order missing stripeAccountId for Connect refund.');
  }

  const orderTotalCents = typeof order.total === 'number' ? order.total : 0;
  const alreadyRefundedCents =
    typeof order.refundedTotalCents === 'number' ? order.refundedTotalCents : 0;
  const remainingRefundableCents = Math.max(
    0,
    orderTotalCents - alreadyRefundedCents
  );
  if (remainingRefundableCents === 0) {
    throw new FullyRefundedError(order.id);
  }

  const paymentIntentId = order.stripePaymentIntentId ?? null;
  const chargeId = order.stripeChargeId ?? null;
  if (!paymentIntentId && !chargeId) {
    throw new Error('Order has no Stripe payment reference.');
  }

  // Compute the refund amount from the selections and adjustments.
  let refundAmountCents = computeRefundAmountCents(order, selections);

  if (typeof options?.refundShippingCents === 'number') {
    refundAmountCents += options.refundShippingCents;
  }
  if (typeof options?.restockingFeeCents === 'number') {
    refundAmountCents -= Math.max(0, options.restockingFeeCents);
  }

  if (refundAmountCents <= 0) {
    throw new Error(
      `Computed refund amount must be > 0 (got ${refundAmountCents} cents).`
    );
  }
  if (refundAmountCents > remainingRefundableCents) {
    throw new ExceedsRefundableError(
      order.id,
      refundAmountCents,
      remainingRefundableCents
    );
  }

  const itemsMap = new Map((order.items ?? []).map((item) => [item.id, item]));

  // Validate items exist
  for (const selection of selections) {
    const orderItem = itemsMap.get(selection.itemId);
    if (!orderItem) {
      throw new Error(
        `Item ${selection.itemId} not found on order ${order.id}`
      );
    }
  }

  const idempotencyKey =
    options?.idempotencyKey ??
    buildIdempotencyKeyV2({ orderId, selections, options });

  const metadata: Stripe.MetadataParam = {
    orderId: order.id,
    ...(order.orderNumber ? { orderNumber: String(order.orderNumber) } : {}),
    selections: JSON.stringify(selections),
    ...(options?.reason ? { app_reason: options.reason } : {}),
    stripeAccountId
  };

  const paymentReference = paymentIntentId
    ? { payment_intent: paymentIntentId }
    : { charge: chargeId as string }; // guaranteed non-null by guard at L94-96

  const createParams: Stripe.RefundCreateParams = {
    amount: refundAmountCents,
    reason: toStripeRefundReason(options?.reason),
    ...paymentReference,
    metadata
  };

  const refund = await stripe.refunds.create(createParams, {
    idempotencyKey,
    stripeAccount: stripeAccountId
  });

  // Map XOR selections → blocks persisted on the refund document
  const selectionBlocks: SelectionBlock[] = selections.map((selection) => {
    // capture common fields BEFORE narrowing to avoid “never”
    const itemId = selection.itemId;
    const orderItem = itemsMap.get(itemId);

    if (isQuantitySelection(selection)) {
      return {
        blockType: 'quantity',
        itemId,
        quantity: Math.trunc(selection.quantity),
        ...(typeof orderItem?.unitAmount === 'number'
          ? { unitAmount: orderItem.unitAmount }
          : {}),
        ...(typeof orderItem?.amountTotal === 'number'
          ? { amountTotal: orderItem.amountTotal }
          : {})
      };
    }

    if (isAmountSelection(selection)) {
      return {
        blockType: 'amount',
        itemId,
        amountCents: Math.trunc(selection.amountCents)
      };
    }

    // exhaustive: TS now knows this is never
    return assertNever(selection as never);
  });

  const record = (await payload.create({
    collection: 'refunds',
    data: {
      order: order.id,
      orderNumber: order.orderNumber ?? String(order.id),
      stripeRefundId: refund.id,
      stripePaymentIntentId: paymentIntentId ?? undefined,
      stripeChargeId: chargeId ?? undefined,
      amount: refund.amount, // echo Stripe
      status: toLocalRefundStatus(refund.status),
      reason: options?.reason ?? undefined,
      selections: selectionBlocks, // ✅ blocks
      fees: {
        restockingFeeCents: options?.restockingFeeCents ?? undefined,
        refundShippingCents: options?.refundShippingCents ?? undefined
      },
      notes: options?.notes ?? undefined,
      idempotencyKey
    },
    overrideAccess: true
  })) as Refund;

  return { refund, record };
}
