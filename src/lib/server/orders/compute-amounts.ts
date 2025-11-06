import { PLATFORM_FEE_PERCENTAGE } from '@/constants';
import { toIntCents, toIntCentsOrNaN } from '@/lib/money';

type OrderItemShape = {
  unitAmount?: unknown; // cents
  quantity?: unknown; // integer units
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
 * Calculate aggregated monetary amounts for an order from item lines and provided totals.
 *
 * Server-authoritative total is derived from line totals + shipping - discounts when item lines exist.
 * If there are no items, the provided input.totalCents is used.
 * Stripe fee is trusted if provided; platform fee prefers the provided value if valid, otherwise computed.
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
    // Quantity: allow NaN sentinel to fall back to 1
    const quantityCandidate = toIntCentsOrNaN(item.quantity);
    const quantity =
      Number.isNaN(quantityCandidate) || quantityCandidate <= 0
        ? 1
        : quantityCandidate;

    // Pre-read provided totals (so we can decide what to do if unitAmount is bad)
    const amountSubtotalCandidate = toIntCentsOrNaN(item.amountSubtotal);
    const amountTotalCandidate = toIntCentsOrNaN(item.amountTotal);

    // Unit amount (cents)
    const unitAmount = toIntCents(item.unitAmount);

    // If unit amount is non-positive AND no explicit subtotals/totals are provided,
    // treat the line as invalid and drop it (prevents "free" items by accident).
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

    // Subtotal (prefer provided; else fallback = unit * qty)
    const fallbackSubtotal = unitAmount * quantity;
    const amountSubtotal = Number.isNaN(amountSubtotalCandidate)
      ? fallbackSubtotal
      : amountSubtotalCandidate;

    // Tax (cents)
    const amountTax = toIntCents(item.amountTax);

    // Line total (prefer provided; else subtotal + tax)
    const amountTotal = Number.isNaN(amountTotalCandidate)
      ? amountSubtotal + amountTax
      : amountTotalCandidate;

    subtotalCents += amountSubtotal;
    taxTotalCents += amountTax;
    lineTotalsCents += amountTotal;
  }

  // Order-level adjustments
  const shippingTotalCents = toIntCents(input.shippingTotalCents);
  const discountTotalCents = toIntCents(input.discountTotalCents);

  // Authoritative server total: derive from lines when items exist; else use provided total.
  const providedTotalCents = toIntCents(input.totalCents);
  const serverTotalCents =
    itemArray.length > 0
      ? Math.max(
          0,
          Math.trunc(lineTotalsCents + shippingTotalCents - discountTotalCents)
        )
      : providedTotalCents;

  // Prefer provided webhook Stripe fee; otherwise 0 (do not guess).
  const stripeFeeCents = toIntCents(input.stripeFeeCents);

  // Platform fee: compute from server total unless a valid provided value exists.
  const platformFeeCandidate = toIntCentsOrNaN(input.platformFeeCents);
  const platformFeeCents = Number.isNaN(platformFeeCandidate)
    ? 0
    : platformFeeCandidate;

  // Seller net = server total - platform fee - Stripe fee
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
