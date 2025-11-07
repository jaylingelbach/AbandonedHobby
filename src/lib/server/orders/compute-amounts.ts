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
 * Calculate aggregated monetary amounts for an order from item lines and provided totals.
 *
 * Server-authoritative total is derived from line totals + shipping - discounts when item lines exist.
 * If there are no items, the provided input.totalCents is used.
 * Stripe fee is trusted if provided; platform fee prefers the provided value if valid, otherwise computed from items subtotal.
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
  const platformFeeCents = Number.isNaN(platformFeeCandidate)
    ? fallbackPlatformFeeCents
    : platformFeeCandidate;

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
