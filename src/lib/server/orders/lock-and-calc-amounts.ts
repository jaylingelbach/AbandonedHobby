import type { CollectionBeforeChangeHook } from 'payload';
import { DECIMAL_PLATFORM_PERCENTAGE } from '@/constants';

/** Narrow, explicit helper to coerce to non-negative integer cents. */
function toIntCents(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

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
  unitAmount?: number | null;
  quantity?: number | null;
  amountSubtotal?: number | null;
  amountTax?: number | null;
  amountTotal?: number | null;
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

/**
 * Computes a server-authoritative amounts block.
 * - item totals are recomputed from items (amountTotal || unit*qty)
 * - shipping/discount/tax/platform/stripe are chosen from:
 *   trusted ctx.fees -> incoming data.amounts (create only) -> persisted amounts -> 0
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

  // 1) Items: prefer incoming for both create/update so admin edits take effect.
  const incomingItemsUnknown = (data as { items?: unknown }).items;
  const itemsArray: OrderItemInput[] = Array.isArray(incomingItemsUnknown)
    ? (incomingItemsUnknown as OrderItemInput[])
    : Array.isArray(persisted.items)
      ? (persisted.items as OrderItemInput[])
      : [];

  // Compute item lines: amountTotalCents prefers explicit amountTotal, else unit*qty
  const itemTotals: number[] = itemsArray.map((raw) => {
    const quantity = Math.max(1, Math.trunc(Number(raw.quantity ?? 1)));
    const unitAmountCents = toIntCents(raw.unitAmount ?? 0);
    const explicitLineTotal = toIntCents(raw.amountTotal ?? 0);
    return explicitLineTotal > 0
      ? explicitLineTotal
      : unitAmountCents * quantity;
  });

  const itemsSubtotalCents = itemTotals.reduce(
    (sum, n) => sum + toIntCents(n),
    0
  );

  // 2) Total (amount actually paid to Stripe, cents)
  // - If this is a system write *or* operation is 'create', accept incoming `data.total`
  // - Otherwise lock to persisted
  const persistedTotalCents = toIntCents(persisted.total ?? 0);
  const incomingTotalCents = toIntCents(
    (data as { total?: unknown }).total ?? persistedTotalCents
  );
  const totalCents =
    operation === 'create' || isSystem
      ? incomingTotalCents
      : persistedTotalCents;

  // 3) Amounts we can take from (trusted) req.context fees first,
  //    else from incoming data.amounts on CREATE (webhook path),
  //    else from persisted amounts.
  const incomingAmounts = ((data as { amounts?: unknown }).amounts ??
    {}) as Partial<AmountsShape>;
  const persistedAmounts = (persisted.amounts ?? {}) as Partial<AmountsShape>;

  const shippingFromCtx = toIntCents(context.fees?.shippingTotalCents);
  const shippingFromIncomingCreate =
    operation === 'create' ? toIntCents(incomingAmounts.shippingTotalCents) : 0;
  const shippingFromPersisted = toIntCents(persistedAmounts.shippingTotalCents);

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

  const shippingTotalCents =
    shippingFromCtx > 0
      ? shippingFromCtx
      : shippingFromIncomingCreate > 0
        ? shippingFromIncomingCreate
        : shippingFromPersisted;
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

  // Compute a gross total from our server-authoritative components.
  const grossTotalCents = Math.max(
    0,
    Math.trunc(
      itemsSubtotalCents +
        shippingTotalCents -
        discountTotalCents +
        taxTotalCents
    )
  );

  // Platform fee: allow ctx override, else respect incoming on create, else compute
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

  // Net payout = gross - platform - stripe (never negative)
  const sellerNetCents = Math.max(
    0,
    grossTotalCents - platformFeeCents - stripeFeeCents
  );

  // 4) Write the normalized block back. Never drop unrelated persisted fields.
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
