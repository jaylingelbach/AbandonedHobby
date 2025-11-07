import { DECIMAL_PLATFORM_PERCENTAGE } from '@/constants';
import { toIntCents, toIntCentsOrNaN } from '@/lib/money';

type OrderItemShape = {
  unitAmount?: unknown; // cents
  quantity?: unknown; // integer units
  amountSubtotal?: unknown; // cents
  amountTax?: unknown; // cents
  amountTotal?: unknown; // cents
};

type Amounts = {
  subtotalCents: number; // items subtotal (no shipping/discount/tax)
  taxTotalCents: number;
  shippingTotalCents: number;
  discountTotalCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  sellerNetCents: number;
};

/**
 * Compute aggregated monetary amounts for an order from item lines and provided totals.
 *
 * When item lines are present, the server-authoritative total is derived from line totals plus shipping minus discounts.
 * If no items are provided, the input.totalCents value is used as the order total. The function trusts a provided
 * stripeFeeCents and prefers a provided platformFeeCents if valid; otherwise it falls back to rounding the items'
 * subtotal by the configured DECIMAL_PLATFORM_PERCENTAGE. Lines with non-positive unit amounts and missing totals are
 * dropped.
 *
 * @returns An Amounts object containing:
 *  - subtotalCents: sum of item subtotals (cents)
 *  - taxTotalCents: sum of item taxes (cents)
 *  - shippingTotalCents: shipping total (cents)
 *  - discountTotalCents: discount total (cents)
 *  - platformFeeCents: platform fee applied (cents)
 *  - stripeFeeCents: trusted Stripe fee (cents)
 *  - sellerNetCents: net payout to the seller (cents)
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
    const quantityCandidate = toIntCentsOrNaN(item.quantity);
    const quantity =
      Number.isNaN(quantityCandidate) || quantityCandidate <= 0
        ? 1
        : quantityCandidate;

    const amountSubtotalCandidate = toIntCentsOrNaN(item.amountSubtotal);
    const amountTotalCandidate = toIntCentsOrNaN(item.amountTotal);

    const unitAmount = toIntCents(item.unitAmount);

    // guard against “free” phantom lines
    if (
      unitAmount <= 0 &&
      Number.isNaN(amountSubtotalCandidate) &&
      Number.isNaN(amountTotalCandidate)
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[computeOrderAmounts] Dropping line with non-positive unitAmount and no provided totals:',
          { item }
        );
      }
      continue;
    }

    const fallbackSubtotal = unitAmount * quantity;
    const amountSubtotal = Number.isNaN(amountSubtotalCandidate)
      ? fallbackSubtotal
      : amountSubtotalCandidate;

    const amountTax = toIntCents(item.amountTax);

    const amountTotal = Number.isNaN(amountTotalCandidate)
      ? amountSubtotal + amountTax
      : amountTotalCandidate;

    subtotalCents += amountSubtotal;
    taxTotalCents += amountTax;
    lineTotalsCents += amountTotal;
  }

  const shippingTotalCents = toIntCents(input.shippingTotalCents);
  const discountTotalCents = toIntCents(input.discountTotalCents);

  const providedTotalCents = toIntCents(input.totalCents);
  const serverTotalCents =
    itemArray.length > 0
      ? Math.max(
          0,
          Math.trunc(lineTotalsCents + shippingTotalCents - discountTotalCents)
        )
      : providedTotalCents;

  // trust webhook for Stripe fee; do not guess
  const stripeFeeCents = toIntCents(input.stripeFeeCents);

  // Prefer provided platform fee; else fallback = % of items subtotal (NOT gross)
  const platformFeeCandidate = toIntCentsOrNaN(input.platformFeeCents);
  const fallbackPlatformFeeCents = Math.max(
    0,
    Math.round(subtotalCents * DECIMAL_PLATFORM_PERCENTAGE)
  );

  const platformFeeIsValid =
    Number.isFinite(platformFeeCandidate) && platformFeeCandidate >= 0;

  const platformFeeCents = platformFeeIsValid
    ? platformFeeCandidate
    : fallbackPlatformFeeCents;

  // Net payout
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
