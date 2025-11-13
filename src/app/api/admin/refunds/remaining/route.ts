import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';

export const runtime = 'nodejs';

const DEBUG_REMAINING = process.env.NODE_ENV === 'development';

const debugLog = (title: string, data?: unknown): void => {
  if (!DEBUG_REMAINING) return;
  console.log(`[refunds][server] ${title}`, data ?? '');
};

/**
 * Compute remaining refundable quantities and amounts for a given order, returning per-item remaining quantities, refunded totals, fully refunded items, and shipping refund status.
 *
 * The endpoint requires an `orderId` search parameter and only allows access to users with the `super-admin` role. If `includePending=true` is provided, pending refunds are counted alongside succeeded refunds when calculating remaining amounts. The function inspects order items and existing refund documents to attribute refunded quantities and cents back to individual items using explicit selections or heuristics.
 *
 * @returns JSON object with:
 * - `ok`: `true` when the operation succeeded.
 * - `byItemId`: record mapping itemId to remaining refundable quantity (number).
 * - `remainingCents`: remaining refundable total for the order in cents.
 * - `refundedQtyByItemId`: record mapping itemId to total refunded quantity (number).
 * - `refundedAmountByItemId`: record mapping itemId to total refunded amount in cents.
 * - `fullyRefundedItemIds`: array of itemIds considered fully refunded by quantity or amount.
 * - `shipping`: object with `originalCents`, `refundedCents`, and `remainingCents` (all in cents).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ---------- Canonical types ----------
  type SelectionQuantity = {
    blockType?: 'quantity';
    type?: 'quantity';
    itemId: string;
    quantity: number;
  };

  type SelectionAmount = {
    blockType?: 'amount';
    type?: 'amount';
    itemId: string;
    amountCents?: number;
    amount?: number;
  };

  type RefundDocumentBase = {
    selections?: unknown[];
    amount?: number; // cents
    status?: string;
    order?: string;
  };

  type RefundDocumentWithFees = RefundDocumentBase & {
    fees?: {
      refundShippingCents?: number | null;
    };
  };

  type OrderItem = {
    id?: string;
    _id?: string;
    quantity?: number;
    unitAmount?: number; // cents
    amountTotal?: number; // cents
  };

  type OrderDocument = {
    id: string;
    total?: number; // cents
    refundedTotalCents?: number; // cents
    items?: OrderItem[];
    amounts?: {
      shippingTotalCents?: number | null;
    };
  };

  // ---------- helpers ----------
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const isString = (value: unknown): value is string =>
    typeof value === 'string';

  const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

  const getSelectionKind = (
    selection: unknown
  ): 'quantity' | 'amount' | null => {
    if (!isObject(selection)) return null;
    const kind = (selection['blockType'] ?? selection['type']) as unknown;
    return kind === 'quantity' || kind === 'amount' ? kind : null;
  };

  const isQuantitySelection = (
    selection: unknown
  ): selection is SelectionQuantity =>
    isObject(selection) &&
    isString(selection['itemId']) &&
    isNumber(selection['quantity']) &&
    getSelectionKind(selection) === 'quantity';

  const isAmountSelection = (
    selection: unknown
  ): selection is SelectionAmount =>
    isObject(selection) &&
    isString(selection['itemId']) &&
    (isNumber(selection['amountCents']) || isNumber(selection['amount'])) &&
    getSelectionKind(selection) === 'amount';

  const pickAmountCents = (selection: SelectionAmount): number =>
    isNumber(selection.amountCents)
      ? Math.trunc(selection.amountCents)
      : isNumber(selection.amount)
        ? Math.trunc(selection.amount)
        : 0;

  const getItemId = (item: OrderItem): string =>
    (item.id ?? item._id ?? '').toString();

  const safeInteger = (value: unknown, fallback = 0): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : fallback;

  const approximatelyEqual = (
    left: number,
    right: number,
    tolerance = 1
  ): boolean => Math.abs(left - right) <= tolerance;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId')?.toString();
    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    const includePending = searchParams.get('includePending') === 'true';

    const payload = await getPayload({ config });
    const payloadRequest = request as unknown as PayloadRequest;

    const { user } = await payload.auth({
      req: payloadRequest,
      headers: request.headers
    });

    const isStaff =
      Array.isArray(user?.roles) && user.roles.includes('super-admin');

    if (!isStaff) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // ---- Load order
    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true
    })) as OrderDocument | null;

    if (!order?.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ---- Refund docs
    const countedStatuses = includePending
      ? ['succeeded', 'pending']
      : ['succeeded'];

    const refundQueryResult = await payload.find({
      collection: 'refunds',
      where: {
        and: [
          { order: { equals: orderId } },
          { status: { in: countedStatuses } }
        ]
      },
      pagination: false,
      depth: 0,
      overrideAccess: true
    });

    const refundDocuments: RefundDocumentWithFees[] = Array.isArray(
      refundQueryResult.docs
    )
      ? (refundQueryResult.docs as RefundDocumentWithFees[])
      : [];

    // ---- Order-level remaining
    const refundedCentsFromRefundDocuments = refundDocuments.reduce(
      (sum, refundDocument) =>
        sum +
        (typeof refundDocument.amount === 'number'
          ? Math.trunc(refundDocument.amount)
          : 0),
      0
    );

    const remainingCentsFromRefundDocuments = Math.max(
      0,
      (order.total ?? 0) - refundedCentsFromRefundDocuments
    );

    const remainingCentsFromOrderCollection = Math.max(
      0,
      (order.total ?? 0) - (order.refundedTotalCents ?? 0)
    );

    const remainingCents =
      refundedCentsFromRefundDocuments > 0
        ? remainingCentsFromRefundDocuments
        : remainingCentsFromOrderCollection;

    // ---- Aggregation maps
    const refundedQuantityByItemId = new Map<string, number>();
    const refundedAmountByItemId = new Map<string, number>();

    const addQuantity = (rawItemId: unknown, quantity: number): void => {
      const itemId = rawItemId == null ? '' : String(rawItemId);
      if (!itemId || quantity <= 0) return;
      refundedQuantityByItemId.set(
        itemId,
        (refundedQuantityByItemId.get(itemId) ?? 0) + Math.trunc(quantity)
      );
    };

    const addAmount = (rawItemId: unknown, cents: number): void => {
      const itemId = rawItemId == null ? '' : String(rawItemId);
      if (!itemId || cents <= 0) return;
      refundedAmountByItemId.set(
        itemId,
        (refundedAmountByItemId.get(itemId) ?? 0) + Math.trunc(cents)
      );
    };

    // ---- Precompute line totals for heuristics
    const lineTotalByItemId = new Map<string, number>();
    const unitAmountByItemId = new Map<string, number>();
    const purchasedQuantityByItemId = new Map<string, number>();

    for (const item of order.items ?? []) {
      const itemId = getItemId(item);
      if (!itemId) continue;

      const purchasedQuantity = safeInteger(item.quantity, 1);
      purchasedQuantityByItemId.set(itemId, purchasedQuantity);

      const unitAmount = safeInteger(item.unitAmount, 0);
      const lineTotal = isNumber(item.amountTotal)
        ? Math.trunc(item.amountTotal)
        : unitAmount * purchasedQuantity;

      lineTotalByItemId.set(itemId, lineTotal);
      unitAmountByItemId.set(itemId, unitAmount);
    }

    // ---- Walk refund documents and aggregate per-item data
    for (const refundDocument of refundDocuments) {
      const selections = Array.isArray(refundDocument.selections)
        ? refundDocument.selections
        : [];

      let foundPerLineAmount = false;
      let singleItemId: string | null = null;
      let uniqueSingleItemId = true;

      // Normal path: read explicit selections
      for (const selection of selections) {
        const selectionKind = getSelectionKind(selection);

        if (selectionKind === 'quantity' && isQuantitySelection(selection)) {
          const selectionItemId = String(selection.itemId);
          addQuantity(selectionItemId, selection.quantity);

          singleItemId = singleItemId ?? selectionItemId;
          if (singleItemId !== selectionItemId) {
            uniqueSingleItemId = false;
          }
          continue;
        }

        if (selectionKind === 'amount' && isAmountSelection(selection)) {
          const selectionItemId = String(selection.itemId);
          addAmount(selectionItemId, pickAmountCents(selection));
          foundPerLineAmount = true;

          singleItemId = singleItemId ?? selectionItemId;
          if (singleItemId !== selectionItemId) {
            uniqueSingleItemId = false;
          }
          continue;
        }
      }

      // Fallback A: if selections pointed to a single item but had no amount,
      // attribute order-level refundDocument.amount to that one item.
      if (
        !foundPerLineAmount &&
        uniqueSingleItemId &&
        singleItemId &&
        isNumber(refundDocument.amount) &&
        refundDocument.amount > 0
      ) {
        addAmount(singleItemId, Math.trunc(refundDocument.amount));
        continue;
      }

      // Fallback B: selections are empty; try to match the refundDocument.amount
      // to exactly one line by amountTotal OR unitAmount (±1¢ tolerance). Only if unique.
      if (
        !foundPerLineAmount &&
        selections.length === 0 &&
        isNumber(refundDocument.amount) &&
        refundDocument.amount > 0
      ) {
        const amount = Math.trunc(refundDocument.amount);
        const candidateItemIds: string[] = [];

        for (const [itemId, lineTotal] of lineTotalByItemId) {
          if (approximatelyEqual(lineTotal, amount)) {
            candidateItemIds.push(itemId);
          }
        }

        if (candidateItemIds.length === 0) {
          for (const [itemId, unitAmount] of unitAmountByItemId) {
            if (approximatelyEqual(unitAmount, amount)) {
              candidateItemIds.push(itemId);
            }
          }
        }

        if (candidateItemIds.length === 1) {
          addAmount(candidateItemIds[0], amount);
        } else {
          debugLog('fallback:B no unique match for order-level amount', {
            docAmount: amount,
            candidates: candidateItemIds
          });
        }
      }
    }

    // ---- Remaining quantity by item
    const remainingQuantityByItemId: Record<string, number> = {};

    for (const item of order.items ?? []) {
      const itemId = getItemId(item);
      if (!itemId) continue;

      const purchasedQuantity = purchasedQuantityByItemId.get(itemId) ?? 0;
      const alreadyRefundedQuantity = refundedQuantityByItemId.get(itemId) ?? 0;

      remainingQuantityByItemId[itemId] = Math.max(
        0,
        purchasedQuantity - alreadyRefundedQuantity
      );
    }

    // ---- Fully-refunded items (qty OR amount)
    const fullyRefundedItemIds: string[] = [];

    for (const item of order.items ?? []) {
      const itemId = getItemId(item);
      if (!itemId) continue;

      const quantityRemaining = remainingQuantityByItemId[itemId] ?? 0;
      const purchasedQuantity = purchasedQuantityByItemId.get(itemId) ?? 0;
      const lineTotal = lineTotalByItemId.get(itemId) ?? 0;
      const refundedAmount = refundedAmountByItemId.get(itemId) ?? 0;

      const coveredByQuantity =
        purchasedQuantity > 0 && quantityRemaining === 0;
      const coveredByAmount =
        lineTotal > 0 && approximatelyEqual(refundedAmount, lineTotal, 1);

      if (coveredByQuantity || coveredByAmount) {
        fullyRefundedItemIds.push(itemId);
      }
    }

    const refundedQuantityByItemIdObject = Object.fromEntries(
      refundedQuantityByItemId.entries()
    );
    const refundedAmountByItemIdObject = Object.fromEntries(
      refundedAmountByItemId.entries()
    );

    // ---- Shipping tracking -----------------------------------------------
    const originalShippingCents = isNumber(order.amounts?.shippingTotalCents)
      ? Math.trunc(order.amounts.shippingTotalCents)
      : 0;

    const refundedShippingCents = refundDocuments.reduce(
      (sum, refundDocument) => {
        const fees = isObject(refundDocument.fees) ? refundDocument.fees : {};
        const shippingPortion = isNumber(fees.refundShippingCents)
          ? Math.trunc(fees.refundShippingCents)
          : 0;
        return sum + shippingPortion;
      },
      0
    );

    const remainingShippingCents = Math.max(
      0,
      originalShippingCents - refundedShippingCents
    );

    return NextResponse.json({
      ok: true,
      byItemId: remainingQuantityByItemId,
      remainingCents,
      refundedQtyByItemId: refundedQuantityByItemIdObject,
      refundedAmountByItemId: refundedAmountByItemIdObject,
      fullyRefundedItemIds,
      shipping: {
        originalCents: originalShippingCents,
        refundedCents: refundedShippingCents,
        remainingCents: remainingShippingCents
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog('error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}