import type {
  LineSelection,
  OrderItemLite,
  OrderLite,
  RefundLine
} from '../../types';

/** Prefer server value when present, else compute from order totals. */
export function getEffectiveRemainingCents(
  order: Pick<OrderLite, 'total' | 'refundedTotalCents'> | null | undefined,
  serverRemaining: number | null
): number {
  if (typeof serverRemaining === 'number' && !Number.isNaN(serverRemaining)) {
    return Math.max(0, serverRemaining);
  }
  const total = order?.total ?? 0;
  const refunded = order?.refundedTotalCents ?? 0;
  return Math.max(0, total - refunded);
}

/** Build UI lines from the order safely. */
export function buildRefundLines(order: OrderLite | null): RefundLine[] {
  const items = order?.items ?? [];
  return items
    .filter(
      (
        item
      ): item is OrderItemLite & { id: NonNullable<OrderItemLite['id']> } =>
        Boolean(item?.id)
    )

    .map((item) => {
      const quantityPurchased =
        typeof item.quantity === 'number' ? item.quantity : 1;
      const unitAmount =
        typeof item.unitAmount === 'number'
          ? item.unitAmount
          : Math.round(
              (item.amountTotal ?? 0) / Math.max(quantityPurchased, 1)
            );

      return {
        itemId: String(item.id),
        name: item.nameSnapshot ?? 'Item',
        unitAmount,
        quantityPurchased,
        quantitySelected: 0,
        amountTotal: item.amountTotal
      };
    });
}

/** Convert { id: '12.34', ... } → { id: 1234, ... } ignoring invalid entries. */
export function dollarsMapToCents(
  dollarsById: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(dollarsById)) {
    const cents = parseMoneyToCentsLocal(v);
    if (Number.isFinite(cents) && cents > 0) out[k] = cents;
  }
  return out;
}

/** Local parse that matches your existing behavior. */
export function parseMoneyToCentsLocal(input: string): number {
  // Accept "1", "1.", "1.2", "1.23", ".99" etc.
  const s = (input ?? '').trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Add the numeric values of an object’s own properties. */
export function sumObjectValues(obj: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(obj)) total += v;
  return total;
}

/**
 * Quantity-prorated subtotal across lines that do NOT have an explicit amount.
 * - Skips a line if partialAmountCentsByItemId[lineId] > 0 (amount overrides quantity)
 */
export function computeItemsSubtotalCents(args: {
  refundLines: RefundLine[];
  quantitiesByItemId: Record<string, number>;
  remainingQtyByItemId: Record<string, number>;
  partialAmountCentsByItemId: Record<string, number>;
  clamp: (n: number, min: number, max: number) => number;
}): number {
  const {
    refundLines,
    quantitiesByItemId,
    remainingQtyByItemId,
    partialAmountCentsByItemId,
    clamp
  } = args;

  return refundLines.reduce((runningTotal, line) => {
    if ((partialAmountCentsByItemId[line.itemId] ?? 0) > 0) return runningTotal;

    const remainingQty =
      remainingQtyByItemId[line.itemId] ?? line.quantityPurchased;
    const selectedQty = clamp(
      quantitiesByItemId[line.itemId] ?? 0,
      0,
      remainingQty
    );
    if (selectedQty === 0) return runningTotal;

    const fullLineTotal =
      typeof line.amountTotal === 'number'
        ? line.amountTotal
        : line.unitAmount * line.quantityPurchased;

    const prorated = Math.round(
      (fullLineTotal * selectedQty) / Math.max(line.quantityPurchased, 1)
    );
    return runningTotal + prorated;
  }, 0);
}

/** itemsSubtotal + partials + shipping - restocking */
export function computePreviewCents(
  itemsSubtotalCents: number,
  partialAmountsTotalCents: number,
  refundShippingCents: number,
  restockingFeeCents: number
): number {
  return (
    itemsSubtotalCents +
    partialAmountsTotalCents +
    Math.max(0, refundShippingCents) -
    Math.max(0, restockingFeeCents)
  );
}

/** Build LineSelection[]: amount overrides quantity per line. */
export function buildSelections(args: {
  refundLines: RefundLine[];
  quantitiesByItemId: Record<string, number>;
  remainingQtyByItemId: Record<string, number>;
  partialAmountCentsByItemId: Record<string, number>;
  clamp: (n: number, min: number, max: number) => number;
}): LineSelection[] {
  const {
    refundLines,
    quantitiesByItemId,
    remainingQtyByItemId,
    partialAmountCentsByItemId,
    clamp
  } = args;

  const selections: LineSelection[] = [];
  for (const line of refundLines) {
    const amountCents = partialAmountCentsByItemId[line.itemId] ?? 0;

    if (amountCents > 0) {
      selections.push({ itemId: line.itemId, amountCents });
      continue;
    }

    const maxQty = remainingQtyByItemId[line.itemId] ?? line.quantityPurchased;
    const quantity = clamp(
      Number(quantitiesByItemId[line.itemId]) || 0,
      0,
      Math.max(0, maxQty)
    );
    if (quantity > 0) {
      selections.push({ itemId: line.itemId, quantity });
    }
  }
  return selections;
}

export type ApiSelection =
  | { type: 'quantity'; itemId: string; quantity: number }
  | { type: 'amount'; itemId: string; amountCents: number }; // <-- note amountCents

/** Map our internal union -> API's discriminated union */
export function toApiSelections(selections: LineSelection[]): ApiSelection[] {
  return selections.map((selection) => {
    if (
      'amountCents' in selection &&
      typeof selection.amountCents === 'number'
    ) {
      return {
        type: 'amount',
        itemId: selection.itemId,
        amountCents: selection.amountCents
      };
    }
    // quantity case
    return {
      type: 'quantity',
      itemId: selection.itemId,
      quantity: selection.quantity
    };
  });
}

/** Runtime sanity check so we fail fast with a clear console error */
export function assertApiSelectionsShape(
  sel: unknown
): asserts sel is ApiSelection[] {
  if (!Array.isArray(sel)) throw new Error('selections must be an array');
  for (const it of sel) {
    if (!it || typeof it !== 'object')
      throw new Error('selection must be an object');
    const t = it.type;
    if (t !== 'quantity' && t !== 'amount') {
      console.error('Bad selection object:', it);
      throw new Error("Invalid selection.type. Expected 'quantity' | 'amount'");
    }
  }
}
