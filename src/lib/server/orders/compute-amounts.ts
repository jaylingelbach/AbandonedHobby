// src/lib/server/orders/compute-amounts.ts
import { PLATFORM_FEE_PERCENTAGE } from '@/constants';

type OrderItemShape = {
  unitAmount?: unknown; // cents
  quantity?: unknown; // integer
  amountSubtotal?: unknown; // cents
  amountTax?: unknown; // cents
  amountTotal?: unknown; // cents
};

type Amounts = {
  subtotalCents: number;
  taxTotalCents: number;
  shippingTotalCents: number;
  discountTotalCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  sellerNetCents: number;
};

function toIntCents(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : Math.max(0, Math.trunc(fallback));
}

/**
 * Compute amounts from items + known fields.
 * - Prefers per-line `amountSubtotal`/`amountTax`/`amountTotal` if present,
 *   otherwise falls back to unitAmount * quantity (+ tax = amountTotal).
 * - `shippingTotalCents` and `discountTotalCents` default to 0 unless supplied.
 * - `stripeFeeCents`:
 *    - If provided (e.g., webhook), trust it.
 *    - Otherwise 0 (do not guess).
 * - `platformFeeCents`:
 *    - Prefer provided value when valid (e.g., webhook),
 *    - Otherwise compute from PLATFORM_FEE_PERCENTAGE using **serverTotalCents**.
 * - **serverTotalCents** (authoritative basis for fees) =
 *    sum(line amountTotal) + shipping - discount  (clamped to integer ≥ 0).
 *   If there are **no items**, fall back to input.totalCents.
 */
export function computeOrderAmounts(input: {
  items: unknown;
  totalCents: unknown; // order.total (Stripe amount_total). Only trusted if no items.
  shippingTotalCents?: unknown;
  discountTotalCents?: unknown;
  stripeFeeCents?: unknown;
  platformFeeCents?: unknown;
}): Amounts {
  const itemArray = Array.isArray(input.items)
    ? (input.items as OrderItemShape[])
    : [];

  let subtotalCents = 0;
  let taxTotalCents = 0;
  let lineTotalsCents = 0;

  for (const item of itemArray) {
    const quantity = toIntCents(item.quantity, 0);
    const unitAmount = toIntCents(item.unitAmount, 0);

    const fallbackSubtotal = unitAmount * quantity;

    const amountSubtotal = (() => {
      const candidate = toIntCents(item.amountSubtotal, NaN);
      return Number.isNaN(candidate) ? fallbackSubtotal : candidate;
    })();

    const amountTax = toIntCents(item.amountTax, 0);

    const amountTotal = (() => {
      const candidate = toIntCents(item.amountTotal, NaN);
      return Number.isNaN(candidate) ? amountSubtotal + amountTax : candidate;
    })();

    subtotalCents += amountSubtotal;
    taxTotalCents += amountTax;
    lineTotalsCents += amountTotal;
  }

  const shippingTotalCents = toIntCents(input.shippingTotalCents, 0);
  const discountTotalCents = toIntCents(input.discountTotalCents, 0);

  // Authoritative server total:
  // If we have items, derive from lines; else fall back to input.totalCents.
  const providedTotalCents = toIntCents(input.totalCents, 0);
  const serverTotalCents =
    itemArray.length > 0
      ? Math.max(
          0,
          Math.trunc(lineTotalsCents + shippingTotalCents - discountTotalCents)
        )
      : providedTotalCents;

  // Prefer provided webhook fee; otherwise 0 (don’t guess).
  const stripeFeeCents = toIntCents(input.stripeFeeCents, 0);

  // Compute platform fee from server total; allow provided (webhook) value if valid.
  const computedPlatformFee = Math.max(
    0,
    Math.trunc((serverTotalCents * PLATFORM_FEE_PERCENTAGE) / 100)
  );
  const platformFeeCandidate = toIntCents(input.platformFeeCents, NaN);
  const platformFeeCents = Number.isNaN(platformFeeCandidate)
    ? computedPlatformFee
    : platformFeeCandidate;

  // Seller net = serverTotal - platform fee - Stripe fee
  const sellerNetCents = Math.max(
    0,
    serverTotalCents - platformFeeCents - stripeFeeCents
  );

  return {
    subtotalCents,
    taxTotalCents,
    shippingTotalCents,
    discountTotalCents,
    platformFeeCents,
    stripeFeeCents,
    sellerNetCents
  };
}
