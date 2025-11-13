import type { CollectionBeforeChangeHook } from 'payload';
import { DECIMAL_PLATFORM_PERCENTAGE } from '@/constants';
import { quoteCalculatedShipping } from '@/modules/shipping/quote';
import type { OrderItemForQuote } from '@/modules/shipping/quote';
import { toIntCents } from '@/lib/money';

import type { ShippingMode } from '@/modules/orders/types';

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
 * Best-effort audit writer for fee override attempts on non-system updates.
 * Uses console.warn and, if available, an "audits" collection.
 */
async function auditFeeOverrideAttempt(args: {
  req: unknown;
  originalDoc: OriginalDocShape;
  incomingAmounts: Partial<AmountsShape>;
  isSystem: boolean;
  operation: 'create' | 'update';
}): Promise<void> {
  const { req, originalDoc, incomingAmounts, isSystem, operation } = args;

  // Extract safe bits from req without using 'any'
  const requestLike = req as {
    user?: { id?: unknown; email?: unknown; username?: unknown } | undefined;
    payload?: {
      create?: (input: {
        collection: string;
        data: Record<string, unknown>;
        overrideAccess?: boolean;
        depth?: number;
        context?: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  };

  const userId =
    typeof requestLike.user?.id === 'string' ? requestLike.user?.id : null;
  const userEmail =
    typeof requestLike.user?.email === 'string'
      ? requestLike.user?.email
      : null;
  const username =
    typeof requestLike.user?.username === 'string'
      ? requestLike.user?.username
      : null;

  const orderId = typeof originalDoc.id === 'string' ? originalDoc.id : null;

  const attemptedPlatform =
    (incomingAmounts.platformFeeCents as number | null | undefined) ?? null;
  const attemptedStripe =
    (incomingAmounts.stripeFeeCents as number | null | undefined) ?? null;

  // Console warning (always)
  console.warn('[orders:audit] Non-system fee override attempt blocked', {
    operation,
    isSystem,
    orderId,
    userId,
    userEmail,
    username,
    attemptedPlatformFeeCents: attemptedPlatform,
    attemptedStripeFeeCents: attemptedStripe
  });

  // Optional: write an audit row if the project has an "audits" collection
  const createFn = requestLike.payload?.create;
  if (typeof createFn === 'function') {
    try {
      await createFn({
        collection: 'audits',
        data: {
          type: 'order_fee_override_attempt',
          source: 'lockAndCalculateAmounts',
          operation,
          isSystem,
          orderId,
          userId,
          userEmail,
          username,
          attemptedPlatformFeeCents: attemptedPlatform,
          attemptedStripeFeeCents: attemptedStripe,
          createdAt: new Date().toISOString()
        },
        overrideAccess: true,
        depth: 0,
        context: { ahSystem: true }
      });
    } catch {
      // Swallow errors: audit should never block order writes
    }
  }
}

/**
 * Computes a server-authoritative amounts block.
 * - Item lines derive subtotal from amountSubtotal || (unitAmount * quantity) or fallbacks.
 * - Shipping/discount/tax/platform/stripe values are chosen from:
 *   trusted req.context.fees -> incoming data.amounts (CREATE only) -> computed defaults (+ persisted when no fresh items).
 * - If fresh items were supplied, we prefer recomputing shipping from those items over reading persisted amounts.
 * - Non-system UPDATE attempts to pass fee fields are audited and ignored.
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

  const itemsSubtotalCents = itemTotals.reduce((sum, n) => sum + n, 0);

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

  // ---- AUDIT: only when a non-system UPDATE actually changes fee values ----
  const incomingHasPlatformField = Object.prototype.hasOwnProperty.call(
    incomingAmounts,
    'platformFeeCents'
  );
  const incomingHasStripeField = Object.prototype.hasOwnProperty.call(
    incomingAmounts,
    'stripeFeeCents'
  );

  const attemptedPlatformRaw = incomingAmounts.platformFeeCents ?? null;
  const attemptedStripeRaw = incomingAmounts.stripeFeeCents ?? null;

  const attemptedPlatformFeeCents =
    typeof attemptedPlatformRaw === 'number'
      ? toIntCents(attemptedPlatformRaw)
      : null;
  const attemptedStripeFeeCents =
    typeof attemptedStripeRaw === 'number'
      ? toIntCents(attemptedStripeRaw)
      : null;

  const persistedPlatformRaw = persistedAmounts.platformFeeCents ?? null;
  const persistedStripeRaw = persistedAmounts.stripeFeeCents ?? null;

  const persistedPlatformFeeCents =
    typeof persistedPlatformRaw === 'number'
      ? toIntCents(persistedPlatformRaw)
      : null;
  const persistedStripeFeeCents =
    typeof persistedStripeRaw === 'number'
      ? toIntCents(persistedStripeRaw)
      : null;

  const platformOverrideAttempt =
    incomingHasPlatformField &&
    attemptedPlatformFeeCents !== null &&
    attemptedPlatformFeeCents !== persistedPlatformFeeCents;

  const stripeOverrideAttempt =
    incomingHasStripeField &&
    attemptedStripeFeeCents !== null &&
    attemptedStripeFeeCents !== persistedStripeFeeCents;

  if (
    operation === 'update' &&
    !isSystem &&
    (platformOverrideAttempt || stripeOverrideAttempt)
  ) {
    await auditFeeOverrideAttempt({
      req,
      originalDoc: persisted,
      incomingAmounts,
      isSystem,
      operation
    });
  }

  // ----- FEES (presence-aware + create/system-only trust for incoming) -----

  // Incoming (honor only on CREATE or when system)
  const platformIncomingRaw =
    operation === 'create' || isSystem
      ? (incomingAmounts.platformFeeCents as number | null | undefined)
      : undefined;
  const hasPlatformFromIncoming =
    platformIncomingRaw !== undefined && platformIncomingRaw !== null;
  const platformFromIncoming = hasPlatformFromIncoming
    ? toIntCents(platformIncomingRaw)
    : 0;

  const stripeFeeIncomingRaw =
    operation === 'create' || isSystem
      ? (incomingAmounts.stripeFeeCents as number | null | undefined)
      : undefined;
  const hasStripeFeeFromIncoming =
    stripeFeeIncomingRaw !== undefined && stripeFeeIncomingRaw !== null;
  const stripeFeeFromIncoming = hasStripeFeeFromIncoming
    ? toIntCents(stripeFeeIncomingRaw)
    : 0;

  // Context (always trusted; presence-aware so 0 can win)
  const platformFromCtxRaw = context.fees?.platformFeeCents;
  const hasPlatformFromCtx =
    platformFromCtxRaw !== undefined && platformFromCtxRaw !== null;
  const platformFromCtx = hasPlatformFromCtx
    ? toIntCents(platformFromCtxRaw)
    : 0;

  const stripeFeeFromCtxRaw = context.fees?.stripeFeeCents;
  const hasStripeFeeFromCtx =
    stripeFeeFromCtxRaw !== undefined && stripeFeeFromCtxRaw !== null;
  const stripeFeeFromCtx = hasStripeFeeFromCtx
    ? toIntCents(stripeFeeFromCtxRaw)
    : 0;

  // Persisted (presence-aware so persisted 0 can remain)
  const platformFromPersistedRaw = persistedAmounts.platformFeeCents;
  const hasPlatformFromPersisted =
    platformFromPersistedRaw !== undefined && platformFromPersistedRaw !== null;
  const platformFromPersisted = hasPlatformFromPersisted
    ? toIntCents(platformFromPersistedRaw)
    : 0;

  const stripeFeeFromPersistedRaw = persistedAmounts.stripeFeeCents;
  const hasStripeFeeFromPersisted =
    stripeFeeFromPersistedRaw !== undefined &&
    stripeFeeFromPersistedRaw !== null;
  const stripeFeeFromPersisted = hasStripeFeeFromPersisted
    ? toIntCents(stripeFeeFromPersistedRaw)
    : 0;

  // Shipping/discount/tax sources
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

  // Presence-aware fee resolution (so 0 can win)
  const stripeFeeCents = hasStripeFeeFromCtx
    ? stripeFeeFromCtx
    : hasStripeFeeFromIncoming
      ? stripeFeeFromIncoming
      : hasStripeFeeFromPersisted
        ? stripeFeeFromPersisted
        : 0;

  const computedPlatformFeeCents = Math.max(
    0,
    Math.round(itemsSubtotalCents * DECIMAL_PLATFORM_PERCENTAGE)
  );

  const platformFeeCents = hasPlatformFromCtx
    ? platformFromCtx
    : hasPlatformFromIncoming
      ? platformFromIncoming
      : hasPlatformFromPersisted
        ? platformFromPersisted
        : computedPlatformFeeCents;

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

  // 6) Net payout = gross - platform - stripe (never negative)
  const sellerNetCents = Math.max(
    0,
    grossTotalCents - platformFeeCents - stripeFeeCents
  );

  // 7) Write the normalized block back. Never drop unrelated persisted fields.
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
