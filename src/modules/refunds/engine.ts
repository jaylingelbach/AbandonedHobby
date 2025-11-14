import type { Payload } from 'payload';
import type { Stripe } from 'stripe';
import { stripe } from '@/lib/stripe';
import {
  EngineOptions,
  OrderWithTotals,
  LineSelection,
  OrderItem,
  SelectionBlockQuantity,
  SelectionBlockAmount,
  SelectionLegacyQuantity,
  SelectionLegacyAmount
} from './types';
import {
  buildIdempotencyKeyV2,
  buildStripeRefundParams,
  computeFinalRefundAmount,
  computeRefundAmountCents,
  toLocalRefundStatus,
  toStripeRefundReason,
  validateSelectionsAgainstCaps
} from './utils';
import { ExceedsRefundableError, FullyRefundedError } from './errors';
import { isFiniteNumber } from '@/lib/money';
import { isObjectRecord, isStringValue } from '@/lib/utils';

function isBlockQuantity(sel: unknown): sel is SelectionBlockQuantity {
  return (
    isObjectRecord(sel) &&
    sel['blockType'] === 'quantity' &&
    isStringValue(sel['itemId']) &&
    isFiniteNumber(sel['quantity'])
  );
}
function isBlockAmount(sel: unknown): sel is SelectionBlockAmount {
  return (
    isObjectRecord(sel) &&
    sel['blockType'] === 'amount' &&
    isStringValue(sel['itemId']) &&
    (isFiniteNumber(sel['amountCents']) || isFiniteNumber(sel['amount']))
  );
}
function isLegacyQuantity(sel: unknown): sel is SelectionLegacyQuantity {
  return (
    isObjectRecord(sel) &&
    isStringValue(sel['itemId']) &&
    isFiniteNumber(sel['quantity']) &&
    !('blockType' in sel)
  );
}
function isLegacyAmount(sel: unknown): sel is SelectionLegacyAmount {
  return (
    isObjectRecord(sel) &&
    isStringValue(sel['itemId']) &&
    (isFiniteNumber(sel['amountCents']) || isFiniteNumber(sel['amount'])) &&
    !('blockType' in sel)
  );
}
function pickAmountCents(
  sel: SelectionBlockAmount | SelectionLegacyAmount
): number {
  if (isFiniteNumber(sel.amountCents)) return Math.trunc(sel.amountCents);
  if (isFiniteNumber(sel.amount)) return Math.trunc(sel.amount);
  return 0;
}

/**
 * Aggregate previously-refunded quantities and per-line amounts for an order.
 * Includes `pending` refunds to be conservative against races.
 */
async function getAlreadyRefundedMaps(args: {
  payload: Payload;
  orderId: string;
}): Promise<{
  refundedQuantityByItemId: Map<string, number>;
  refundedAmountByItemId: Map<string, number>;
}> {
  const { payload, orderId } = args;

  const countedStatuses = ['succeeded', 'pending'];

  const { docs } = await payload.find({
    collection: 'refunds',
    where: {
      and: [{ order: { equals: orderId } }, { status: { in: countedStatuses } }]
    },
    pagination: false,
    depth: 0,
    overrideAccess: true
  });

  const refundedQuantityByItemId = new Map<string, number>();
  const refundedAmountByItemId = new Map<string, number>();

  function addQuantity(itemId: string, quantity: number) {
    if (!itemId || quantity <= 0) return;
    refundedQuantityByItemId.set(
      itemId,
      (refundedQuantityByItemId.get(itemId) ?? 0) + Math.trunc(quantity)
    );
  }
  function addAmount(itemId: string, cents: number) {
    if (!itemId || cents <= 0) return;
    refundedAmountByItemId.set(
      itemId,
      (refundedAmountByItemId.get(itemId) ?? 0) + Math.trunc(cents)
    );
  }

  for (const doc of docs as Array<{
    selections?: unknown[];
    amount?: unknown;
  }>) {
    const rawSelections = Array.isArray(doc.selections) ? doc.selections : [];

    let foundAnyPerLineAmount = false;
    let singleItemId: string | null = null;
    let uniqueItemCandidate = true;

    for (const sel of rawSelections) {
      if (isBlockQuantity(sel)) {
        addQuantity(sel.itemId, sel.quantity);
        if (singleItemId === null) singleItemId = sel.itemId;
        else if (singleItemId !== sel.itemId) uniqueItemCandidate = false;
        continue;
      }
      if (isBlockAmount(sel)) {
        addAmount(sel.itemId, pickAmountCents(sel));
        foundAnyPerLineAmount = true;
        if (singleItemId === null) singleItemId = sel.itemId;
        else if (singleItemId !== sel.itemId) uniqueItemCandidate = false;
        continue;
      }
      if (isLegacyQuantity(sel)) {
        addQuantity(sel.itemId, sel.quantity);
        if (singleItemId === null) singleItemId = sel.itemId;
        else if (singleItemId !== sel.itemId) uniqueItemCandidate = false;
        continue;
      }
      if (isLegacyAmount(sel)) {
        addAmount(sel.itemId, pickAmountCents(sel));
        foundAnyPerLineAmount = true;
        if (singleItemId === null) singleItemId = sel.itemId;
        else if (singleItemId !== sel.itemId) uniqueItemCandidate = false;
        continue;
      }
    }

    // Fallback: if no per-line amounts but exactly one item referenced,
    // attribute the doc.amount to that single item.
    if (!foundAnyPerLineAmount && uniqueItemCandidate && singleItemId) {
      const raw = (doc.amount ?? 0) as unknown;
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(numeric) && numeric > 0) {
        addAmount(singleItemId, Math.trunc(numeric));
      }
    }
  }

  return { refundedQuantityByItemId, refundedAmountByItemId };
}

type LineSelectionWithQuantity = Extract<LineSelection, { quantity: number }>;

function hasQuantity(sel: LineSelection): sel is LineSelectionWithQuantity {
  return 'quantity' in sel;
}

async function createRefundRecord(args: {
  payload: Payload;
  order: OrderWithTotals;
  selections: LineSelection[];
  itemById: Map<string, OrderItem>;
  options: EngineOptions | undefined;
  refund: Stripe.Refund;
  paymentIntentId: string | null;
  chargeId: string | null;
  idempotencyKey: string;
  refundAmount: number;
}) {
  const {
    payload,
    order,
    selections,
    itemById,
    options,
    refund,
    paymentIntentId,
    chargeId,
    idempotencyKey,
    refundAmount
  } = args;

  const selectionsForRecord = selections.map((selection) => {
    const source = itemById.get(selection.itemId);
    const unitAmount =
      typeof source?.unitAmount === 'number' ? source.unitAmount : 0;
    const amountTotal =
      typeof source?.amountTotal === 'number' ? source.amountTotal : 0;

    if (hasQuantity(selection)) {
      return {
        itemId: selection.itemId,
        quantity: Math.trunc(selection.quantity),
        unitAmount,
        amountTotal,
        blockType: 'quantity' as const
      };
    }

    return {
      itemId: selection.itemId,
      amountCents: Math.trunc(selection.amountCents),
      unitAmount,
      amountTotal,
      blockType: 'amount' as const
    };
  });

  const record = await payload.create({
    collection: 'refunds',
    data: {
      order: order.id,
      orderNumber: order.orderNumber,
      stripeRefundId: refund.id,
      stripePaymentIntentId: paymentIntentId ?? undefined,
      stripeChargeId: chargeId ?? undefined,
      amount: refundAmount,
      status: toLocalRefundStatus(refund.status),
      reason: options?.reason ?? undefined,
      selections: selectionsForRecord,
      fees: {
        restockingFeeCents: options?.restockingFeeCents ?? undefined,
        refundShippingCents: options?.refundShippingCents ?? undefined
      },
      notes: options?.notes ?? undefined,
      idempotencyKey
    },
    overrideAccess: true
  });

  return record;
}

/**
 * Initiates a Stripe refund for an order based on line selections and optional adjustments, and persists an audit record.
 *
 * @param orderId - ID of the order to refund
 * @param selections - Array of line selections; may be empty for shipping-only refunds
 * @param options - Optional adjustments and metadata (e.g., refundShippingCents, restockingFeeCents, reason, idempotencyKey)
 * @returns An object containing the Stripe refund and the created refund record
 * @throws FullyRefundedError when the order has no remaining refundable balance
 * @throws ExceedsRefundableError when the computed refund amount exceeds the order's remaining refundable balance
 * @throws Error for validation failures (missing order, missing Stripe references, invalid selections, or non-positive computed refund)
 */
export async function createRefundForOrder(args: {
  payload: Payload;
  orderId: string;
  selections: LineSelection[];
  options?: EngineOptions;
}) {
  const { payload, orderId, selections, options } = args;

  if (!Array.isArray(selections)) {
    throw new Error('Selections must be an array');
  }

  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true
  })) as unknown as OrderWithTotals;

  if (!order?.id) throw new Error('Order not found');

  const stripeAccountId = order.stripeAccountId;
  if (!stripeAccountId) {
    throw new Error('Order missing stripeAccountId for Connect refund.');
  }

  const paymentIntentId = order.stripePaymentIntentId ?? null;
  const chargeId = order.stripeChargeId ?? null;
  if (!paymentIntentId && !chargeId) {
    throw new Error('Order has no Stripe payment reference');
  }

  const totalCents = typeof order.total === 'number' ? order.total : 0;
  const alreadyRefundedOrderCents =
    typeof order.refundedTotalCents === 'number' ? order.refundedTotalCents : 0;
  const remainingRefundableOrderCents = Math.max(
    0,
    totalCents - alreadyRefundedOrderCents
  );
  if (remainingRefundableOrderCents === 0) {
    throw new FullyRefundedError(order.id);
  }

  const { refundedQuantityByItemId, refundedAmountByItemId } =
    await getAlreadyRefundedMaps({ payload, orderId });

  const items = Array.isArray(order.items) ? order.items : [];
  const itemById = new Map<string, OrderItem>();
  for (const item of items) {
    if (typeof item.id === 'string' && item.id) {
      itemById.set(item.id, item);
    }
  }

  validateSelectionsAgainstCaps({
    order,
    selections,
    itemById,
    refundedQuantityByItemId,
    refundedAmountByItemId
  });

  const refundAmount = computeFinalRefundAmount({
    order,
    selections,
    options,
    remainingRefundableOrderCents
  });

  const { stripeArgs, idempotencyKey } = buildStripeRefundParams({
    order,
    orderId,
    selections,
    options,
    refundAmount,
    paymentIntentId,
    chargeId,
    stripeAccountId
  });

  const refund = await stripe.refunds.create(stripeArgs, {
    idempotencyKey,
    stripeAccount: stripeAccountId
  });

  const record = await createRefundRecord({
    payload,
    order,
    selections,
    itemById,
    options,
    refund,
    paymentIntentId,
    chargeId,
    idempotencyKey,
    refundAmount
  });

  return { refund, record };
}
