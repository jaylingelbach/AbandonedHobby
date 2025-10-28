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

/**
 * Convert a value to an integer cents amount, using the fallback when the input is not a finite number.
 *
 * @param value - Input to convert; if a finite number it is truncated toward zero and clamped to be greater than or equal to zero.
 * @param fallback - Value used when `value` is not a finite number; truncated toward zero and clamped to be greater than or equal to zero.
 * @returns An integer number of cents greater than or equal to zero.
 */
function toIntCents(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : Math.max(0, Math.trunc(fallback));
}

/**
 * Calculate aggregated monetary amounts for an order from item lines and provided totals.
 *
 * The function derives an authoritative server total from line item totals plus shipping minus discounts when items exist;
 * if there are no items, `input.totalCents` is used. `shippingTotalCents` and `discountTotalCents` default to 0 when not supplied.
 * If `stripeFeeCents` is provided it is trusted, otherwise 0 is used. `platformFeeCents` prefers a provided value when valid,
 * otherwise it is computed from `PLATFORM_FEE_PERCENTAGE` applied to the server total.
 *
 * @param input - Input object containing order details. `totalCents` is only trusted when no items are present. `shippingTotalCents` and `discountTotalCents` default to 0. `stripeFeeCents` is trusted when provided; `platformFeeCents` is used when valid otherwise computed from the server total.
 * @returns An object with the following cent-denominated fields:
 * - `subtotalCents`: sum of line subtotals
 * - `taxTotalCents`: sum of line taxes
 * - `shippingTotalCents`: shipping total (defaults to 0)
 * - `discountTotalCents`: discount total (defaults to 0)
 * - `platformFeeCents`: platform fee (provided or computed from server total)
 * - `stripeFeeCents`: Stripe fee (provided or 0)
 * - `sellerNetCents`: server total minus platform and Stripe fees, clamped to 0 or greater
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