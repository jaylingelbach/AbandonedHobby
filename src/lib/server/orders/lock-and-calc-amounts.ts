import type { CollectionBeforeChangeHook } from 'payload';
import { DECIMAL_PLATFORM_PERCENTAGE } from '@/constants';
import { quoteCalculatedShipping } from '@/modules/shipping/quote';
import type { OrderItemForQuote } from '@/modules/shipping/quote';

/** Narrow, explicit helper to coerce to non-negative integer cents. */
function toIntCents(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

type ShippingMode = 'free' | 'flat' | 'calculated';

type AmountsShape = {
  subtotalCents: number;
  taxTotalCents: number;
  shippingTotalCents: number;
  discountTotalCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  sellerNetCents: number;
};

type OrderItemInput = {
  unitAmount?: number | null; // cents
  quantity?: number | null; // integer
  amountSubtotal?: number | null; // cents
  amountTax?: number | null; // cents
  amountTotal?: number | null; // cents

  // Shipping snapshot on each line
  shippingMode?: ShippingMode | null;
  shippingSubtotalCents?: number | null; // cents (for flat, quantity-applied)
};

type ShippingAddressShape = {
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
};

type OriginalDocShape = {
  id?: string;
  total?: number;
  items?: OrderItemInput[] | null;
  amounts?: Partial<AmountsShape> | null;
};

type ReqContextFees = {
  ahSystem?: boolean; // mark trusted writes (e.g., Stripe webhook)
  fees?: Partial<
    Pick<
      AmountsShape,
      | 'shippingTotalCents'
      | 'discountTotalCents'
      | 'taxTotalCents'
      | 'platformFeeCents'
      | 'stripeFeeCents'
    >
  >;
};

type IncomingDataShape = {
  total?: unknown;
  items?: unknown;
  amounts?: unknown;
  shipping?: ShippingAddressShape;
};

/**
 * Returns true when shipping can be derived from the current items:
 * - any line is `calculated`, or
 * - any `flat` line has a positive `shippingSubtotalCents`.
 */
function hasDerivableShippingFromItems(items: OrderItemInput[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  for (const item of items) {
    const mode: ShippingMode =
      (item.shippingMode as ShippingMode | undefined) ?? 'free';
    if (mode === 'calculated') return true;
    if (mode === 'flat' && toIntCents(item.shippingSubtotalCents ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

/**
 * We compute shipping from items/quote only if:
 * - no shipping provided by context, incoming-on-create, or persisted amounts,
 * - and the items suggest we can/should derive shipping (see above).
 */
function shouldComputeShippingTotal(
  fromCtx: number,
  fromIncomingCreate: number,
  fromPersisted: number,
  items: OrderItemInput[]
): boolean {
  const noneProvided =
    toIntCents(fromCtx) === 0 &&
    toIntCents(fromIncomingCreate) === 0 &&
    toIntCents(fromPersisted) === 0;
  return noneProvided && hasDerivableShippingFromItems(items);
}

/**
 * Computes a server-authoritative amounts block.
 * - Item lines derive subtotal from amountSubtotal || (unitAmount * quantity) or fallbacks.
 * - Shipping/discount/tax/platform/stripe values are chosen from:
 *   trusted req.context.fees -> incoming data.amounts (CREATE only) -> computed defaults (+ persisted when no fresh items).
 * - If fresh items were supplied, we prefer recomputing shipping from those items over reading persisted amounts.
 */
export const lockAndCalculateAmounts: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req
}) => {
  if (!data) return data;

  const context = (req?.context ?? {}) as ReqContextFees;
  const isSystem = context.ahSystem === true;

  const persisted: OriginalDocShape =
    (originalDoc as OriginalDocShape | undefined) ?? {};
  const incoming = data as IncomingDataShape;

  const hasIncomingItems = Array.isArray(incoming.items);

  // 1) Items: prefer incoming (create + update) so admin edits take effect.
  const itemsArray: OrderItemInput[] = hasIncomingItems
    ? (incoming.items as OrderItemInput[])
    : Array.isArray(persisted.items)
      ? (persisted.items as OrderItemInput[])
      : [];

  // Compute item line subtotals:
  // amountSubtotal (preferred) -> amountTotal - amountTax -> amountTotal -> unitAmount * quantity.
  const itemTotals: number[] = itemsArray.map((raw) => {
    const quantity = Math.max(1, Math.trunc(Number(raw.quantity ?? 1)));
    const unitAmountCents = toIntCents(raw.unitAmount ?? 0);
    const explicitSubtotal = toIntCents(raw.amountSubtotal ?? 0);
    const explicitTotal = toIntCents(raw.amountTotal ?? 0);
    const explicitTax = toIntCents(raw.amountTax ?? 0);

    if (explicitSubtotal > 0) {
      return explicitSubtotal;
    }
    if (explicitTotal > 0 && explicitTax > 0) {
      return Math.max(0, explicitTotal - explicitTax);
    }
    if (explicitTotal > 0) {
      return explicitTotal;
    }
    return unitAmountCents * quantity;
  });

  const itemsSubtotalCents = itemTotals.reduce(
    (sum, n) => sum + toIntCents(n),
    0
  );

  // 2) Total (amount actually paid to Stripe, cents)
  // - If this is a system write *or* operation is 'create', accept incoming `data.total`
  // - Otherwise lock to persisted
  const persistedTotalCents = toIntCents(persisted.total ?? 0);
  const incomingTotalCents = toIntCents(incoming.total ?? persistedTotalCents);
  const totalCents =
    operation === 'create' || isSystem
      ? incomingTotalCents
      : persistedTotalCents;

  // 3) Amounts precedence shells (context → incoming-on-create → persisted)
  const incomingAmounts =
    ((incoming.amounts ?? {}) as Partial<AmountsShape>) || {};
  const persistedAmounts = (persisted.amounts ?? {}) as Partial<AmountsShape>;

  // Shipping: if caller supplied items, do NOT let persisted short-circuit recomputation.
  const shippingFromCtx = toIntCents(context.fees?.shippingTotalCents);
  const shippingFromIncomingCreate =
    operation === 'create' ? toIntCents(incomingAmounts.shippingTotalCents) : 0;
  const shippingFromPersisted = hasIncomingItems
    ? 0
    : toIntCents(persistedAmounts.shippingTotalCents);

  const discountFromCtx = toIntCents(context.fees?.discountTotalCents);
  const discountFromIncomingCreate =
    operation === 'create' ? toIntCents(incomingAmounts.discountTotalCents) : 0;
  const discountFromPersisted = toIntCents(persistedAmounts.discountTotalCents);

  const taxFromCtx = toIntCents(context.fees?.taxTotalCents);
  const taxFromIncomingCreate =
    operation === 'create' ? toIntCents(incomingAmounts.taxTotalCents) : 0;
  const taxFromPersisted = toIntCents(persistedAmounts.taxTotalCents);

  const stripeFeeFromCtx = toIntCents(context.fees?.stripeFeeCents);
  const stripeFeeFromIncomingCreate =
    operation === 'create' ? toIntCents(incomingAmounts.stripeFeeCents) : 0;
  const stripeFeeFromPersisted = toIntCents(persistedAmounts.stripeFeeCents);

  // 4) Compute shipping from current lines (only if not provided by ctx/incoming/persisted)
  //    - Sum flat line shipping (already quantity-applied per line)
  //    - If any line is "calculated", call quoteCalculatedShipping() (MVP may return 0)
  let shippingFromComputed = 0;

  if (
    shouldComputeShippingTotal(
      shippingFromCtx,
      shippingFromIncomingCreate,
      shippingFromPersisted, // will be 0 when hasIncomingItems is true
      itemsArray
    )
  ) {
    // Flat (sum quantity-applied per-line shipping)
    for (const item of itemsArray) {
      const mode: ShippingMode =
        (item.shippingMode as ShippingMode | undefined) ?? 'free';
      if (mode === 'flat') {
        shippingFromComputed += toIntCents(item.shippingSubtotalCents ?? 0);
      }
    }

    // Calculated (if any line requests it)
    const needsCalculated = itemsArray.some(
      (item) =>
        ((item.shippingMode as ShippingMode | undefined) ?? 'free') ===
        'calculated'
    );

    if (needsCalculated) {
      try {
        const itemsForQuote: OrderItemForQuote[] = itemsArray.map((i) => ({
          shippingMode: (i.shippingMode ?? undefined) as
            | ShippingMode
            | undefined,
          shippingSubtotalCents: toIntCents(i.shippingSubtotalCents ?? 0),
          quantity:
            typeof i.quantity === 'number'
              ? Math.max(1, Math.trunc(i.quantity))
              : 1
        }));

        const quote = await quoteCalculatedShipping(
          itemsForQuote,
          incoming.shipping
        );
        shippingFromComputed += toIntCents(quote?.totalCents ?? 0);
      } catch (error) {
        // Fail-safe: if quoting fails, treat as 0 to avoid blocking persistence
        console.error(
          'Shipping quote failed, treating as free shipping:',
          error
        );
        shippingFromComputed += 0;
      }
    }
  }

  // Final selection:
  // - If items were supplied, prefer computed over persisted.
  // - Otherwise keep original order (persisted over computed).
  const shippingTotalCents =
    shippingFromCtx > 0
      ? shippingFromCtx
      : shippingFromIncomingCreate > 0
        ? shippingFromIncomingCreate
        : hasIncomingItems
          ? shippingFromComputed
          : shippingFromPersisted > 0
            ? shippingFromPersisted
            : shippingFromComputed; // may be 0 (free) or > 0

  const discountTotalCents =
    discountFromCtx > 0
      ? discountFromCtx
      : discountFromIncomingCreate > 0
        ? discountFromIncomingCreate
        : discountFromPersisted;

  const taxTotalCents =
    taxFromCtx > 0
      ? taxFromCtx
      : taxFromIncomingCreate > 0
        ? taxFromIncomingCreate
        : taxFromPersisted;

  const stripeFeeCents =
    stripeFeeFromCtx > 0
      ? stripeFeeFromCtx
      : stripeFeeFromIncomingCreate > 0
        ? stripeFeeFromIncomingCreate
        : stripeFeeFromPersisted;

  // 5) Compute a gross total from our server-authoritative components.
  const grossTotalCents = Math.max(
    0,
    Math.trunc(
      itemsSubtotalCents +
        shippingTotalCents -
        discountTotalCents +
        taxTotalCents
    )
  );

  // 6) Platform fee: allow ctx override, else respect incoming on create, else compute
  const platformFromCtx = toIntCents(context.fees?.platformFeeCents);
  const platformFromIncomingCreate =
    operation === 'create' ? toIntCents(incomingAmounts.platformFeeCents) : 0;
  const platformFromPersisted = toIntCents(persistedAmounts.platformFeeCents);

  const computedPlatformFeeCents = Math.max(
    0,
    Math.trunc(grossTotalCents * DECIMAL_PLATFORM_PERCENTAGE)
  );

  const platformFeeCents =
    platformFromCtx > 0
      ? platformFromCtx
      : platformFromIncomingCreate > 0
        ? platformFromIncomingCreate
        : platformFromPersisted > 0
          ? platformFromPersisted
          : computedPlatformFeeCents;

  // 7) Net payout = gross - platform - stripe (never negative)
  const sellerNetCents = Math.max(
    0,
    grossTotalCents - platformFeeCents - stripeFeeCents
  );

  // 8) Write the normalized block back. Never drop unrelated persisted fields.
  const nextAmounts: AmountsShape = {
    ...persistedAmounts,
    subtotalCents: itemsSubtotalCents,
    taxTotalCents: taxTotalCents,
    shippingTotalCents: shippingTotalCents,
    discountTotalCents: discountTotalCents,
    platformFeeCents: platformFeeCents,
    stripeFeeCents: stripeFeeCents,
    sellerNetCents: sellerNetCents
  };

  return {
    ...data,
    total: totalCents,
    amounts: nextAmounts
  };
};
