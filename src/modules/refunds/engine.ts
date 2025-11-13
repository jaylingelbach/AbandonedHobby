import type { Payload } from 'payload';
import type { Stripe } from 'stripe';
import { stripe } from '@/lib/stripe';
import {
  EngineOptions,
  OrderWithTotals,
  LineSelection,
  OrderItem
} from './types';
import {
  buildIdempotencyKeyV2,
  computeRefundAmountCents,
  toLocalRefundStatus,
  toStripeRefundReason
} from './utils';
import { ExceedsRefundableError, FullyRefundedError } from './errors';

/** Type guards for reading historical refund selections safely */
type SelectionBlockQuantity = {
  blockType: 'quantity';
  itemId: string;
  quantity: number;
};
type SelectionBlockAmount = {
  blockType: 'amount';
  itemId: string;
  amountCents?: number;
  amount?: number;
};
type SelectionLegacyQuantity = { itemId: string; quantity: number };
type SelectionLegacyAmount = {
  itemId: string;
  amountCents?: number;
  amount?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBlockQuantity(sel: unknown): sel is SelectionBlockQuantity {
  return (
    isObject(sel) &&
    sel['blockType'] === 'quantity' &&
    isString(sel['itemId']) &&
    isFiniteNumber(sel['quantity'])
  );
}
function isBlockAmount(sel: unknown): sel is SelectionBlockAmount {
  return (
    isObject(sel) &&
    sel['blockType'] === 'amount' &&
    isString(sel['itemId']) &&
    (isFiniteNumber(sel['amountCents']) || isFiniteNumber(sel['amount']))
  );
}
function isLegacyQuantity(sel: unknown): sel is SelectionLegacyQuantity {
  return (
    isObject(sel) &&
    isString(sel['itemId']) &&
    isFiniteNumber(sel['quantity']) &&
    !('blockType' in sel)
  );
}
function isLegacyAmount(sel: unknown): sel is SelectionLegacyAmount {
  return (
    isObject(sel) &&
    isString(sel['itemId']) &&
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

/** Resolve a line's "total cents" using snapshot totals when available */
function getLineTotalCents(item: OrderItem): number {
  if (typeof item.amountTotal === 'number') return item.amountTotal;
  const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
  const unitAmount = typeof item.unitAmount === 'number' ? item.unitAmount : 0;
  return unitAmount * quantity;
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

  // ⬇️ Allow empty selections (for shipping-only refunds); still require an array.
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

  // ---- Order-level remaining
  const totalCents = typeof order.total === 'number' ? order.total : 0;
  const alreadyRefundedOrderCents =
    typeof order.refundedTotalCents === 'number' ? order.refundedTotalCents : 0;
  const remainingRefundableOrderCents = Math.max(
    0,
    totalCents - alreadyRefundedOrderCents
  );
  if (remainingRefundableOrderCents === 0)
    throw new FullyRefundedError(order.id);

  // ---- Per-line caps from historical refunds
  const { refundedQuantityByItemId, refundedAmountByItemId } =
    await getAlreadyRefundedMaps({ payload, orderId });

  // Build quick index for items
  const items = Array.isArray(order.items) ? order.items : [];
  const itemById = new Map<string, OrderItem>();
  for (const item of items) {
    if (typeof item.id === 'string' && item.id) {
      itemById.set(item.id, item);
    }
  }

  // Validate each incoming selection against residual per-line caps
  for (const selection of selections) {
    const sourceItem = itemById.get(selection.itemId);
    if (!sourceItem) {
      throw new Error(
        `Item ${selection.itemId} not found in order ${order.id}`
      );
    }

    const purchasedQuantity =
      typeof sourceItem.quantity === 'number' &&
      Number.isFinite(sourceItem.quantity)
        ? Math.trunc(sourceItem.quantity)
        : 1;

    const alreadyRefundedQuantity =
      refundedQuantityByItemId.get(selection.itemId) ?? 0;
    const remainingRefundableQuantity = Math.max(
      0,
      purchasedQuantity - Math.trunc(alreadyRefundedQuantity)
    );

    const lineTotalCents = getLineTotalCents(sourceItem);
    const alreadyRefundedAmountForLine =
      refundedAmountByItemId.get(selection.itemId) ?? 0;
    const remainingRefundableAmountForLine = Math.max(
      0,
      lineTotalCents - Math.trunc(alreadyRefundedAmountForLine)
    );

    // Branch on selection type
    if ('quantity' in selection) {
      if (
        typeof selection.quantity !== 'number' ||
        !Number.isFinite(selection.quantity)
      ) {
        throw new Error(`Invalid quantity for item ${selection.itemId}`);
      }
      const requestedQty = Math.trunc(selection.quantity);
      if (requestedQty <= 0) {
        throw new Error(`Invalid quantity for item ${selection.itemId}`);
      }
      if (requestedQty > remainingRefundableQuantity) {
        throw new Error(
          `Quantity ${requestedQty} exceeds remaining refundable units (${remainingRefundableQuantity}) for item ${selection.itemId}`
        );
      }
    } else {
      // amountCents branch
      const requestedCents = Math.trunc(selection.amountCents);
      if (!Number.isFinite(requestedCents) || requestedCents <= 0) {
        throw new Error(`Invalid amountCents for item ${selection.itemId}`);
      }
      if (requestedCents > remainingRefundableAmountForLine) {
        throw new Error(
          `amountCents (${requestedCents}) exceeds remaining refundable balance (${remainingRefundableAmountForLine}) for item ${selection.itemId}`
        );
      }
    }
  }

  // Compute the refund amount from the selections (now known safe per-line),
  // then apply shipping and restocking adjustments.
  let refundAmount = computeRefundAmountCents(order, selections);

  if (typeof options?.refundShippingCents === 'number') {
    refundAmount += Math.trunc(options.refundShippingCents);
  }
  if (typeof options?.restockingFeeCents === 'number') {
    refundAmount -= Math.max(0, Math.trunc(options.restockingFeeCents));
  }

  if (refundAmount <= 0) {
    throw new Error(
      `Computed refund amount must be > 0 (got ${refundAmount} cents)`
    );
  }
  if (refundAmount > remainingRefundableOrderCents) {
    throw new ExceedsRefundableError(
      order.id,
      refundAmount,
      remainingRefundableOrderCents
    );
  }

  const idempotencyKey =
    options?.idempotencyKey ??
    buildIdempotencyKeyV2({ orderId, selections, options });

  const metadata: Stripe.MetadataParam = {
    orderId: order.id,
    ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
    selections: JSON.stringify(selections),
    ...(options?.reason ? { app_reason: options.reason } : {}),
    stripeAccountId
  };

  const stripeArgs: Stripe.RefundCreateParams = {
    amount: refundAmount,
    reason: toStripeRefundReason(options?.reason),
    ...(paymentIntentId
      ? { payment_intent: paymentIntentId }
      : { charge: chargeId! }),
    metadata
  };

  const refund = await stripe.refunds.create(stripeArgs, {
    idempotencyKey,
    stripeAccount: stripeAccountId
  });

  // Persist an audit record in your Refunds collection
  type LineSelectionWithQuantity = Extract<LineSelection, { quantity: number }>;
  /**
   * Determine whether a line selection specifies a quantity.
   *
   * @param sel - The line selection to test
   * @returns `true` if `sel` includes a numeric `quantity` property and therefore is a `LineSelectionWithQuantity`, `false` otherwise.
   */
  function hasQuantity(sel: LineSelection): sel is LineSelectionWithQuantity {
    return 'quantity' in sel; // zod schema guarantees when present it is a number
  }

  const selectionsForRecord = selections.map((selection) => {
    const source = itemById.get(selection.itemId);
    if (hasQuantity(selection)) {
      return {
        itemId: selection.itemId,
        quantity: Math.trunc(selection.quantity),
        unitAmount:
          typeof source?.unitAmount === 'number' ? source.unitAmount : 0,
        amountTotal:
          typeof source?.amountTotal === 'number' ? source.amountTotal : 0,
        blockType: 'quantity' as const
      };
    } else {
      return {
        itemId: selection.itemId,
        amountCents: Math.trunc(selection.amountCents),
        unitAmount:
          typeof source?.unitAmount === 'number' ? source.unitAmount : 0,
        amountTotal:
          typeof source?.amountTotal === 'number' ? source.amountTotal : 0,
        blockType: 'amount' as const
      };
    }
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

  return { refund, record };
}