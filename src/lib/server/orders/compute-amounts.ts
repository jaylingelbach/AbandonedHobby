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
 * Compute amounts from items + known fields.
 * - Prefers per-line `amountSubtotal`/`amountTax`/`amountTotal` if present,
 *   otherwise falls back to unitAmount * quantity.
 * - `shippingTotalCents` and `discountTotalCents` default to 0 unless supplied.
 * - `stripeFeeCents`:
 *    - If provided (e.g., webhook), trust it.
 *    - Otherwise 0 (do not guess).
 * - `platformFeeCents` derived from PLATFORM_FEE_PERCENTAGE if not provided.
 */
export function computeOrderAmounts(input: {
  items: unknown;
  totalCents: unknown; // order.total
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
    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity)
        ? Math.max(0, Math.trunc(item.quantity))
        : 0;

    const unitAmount =
      typeof item.unitAmount === 'number' && Number.isFinite(item.unitAmount)
        ? Math.max(0, Math.trunc(item.unitAmount))
        : 0;

    const fallbackSubtotal = unitAmount * quantity;

    const amountSubtotal =
      typeof item.amountSubtotal === 'number' &&
      Number.isFinite(item.amountSubtotal)
        ? Math.max(0, Math.trunc(item.amountSubtotal))
        : fallbackSubtotal;

    const amountTax =
      typeof item.amountTax === 'number' && Number.isFinite(item.amountTax)
        ? Math.max(0, Math.trunc(item.amountTax))
        : 0;

    const amountTotal =
      typeof item.amountTotal === 'number' && Number.isFinite(item.amountTotal)
        ? Math.max(0, Math.trunc(item.amountTotal))
        : amountSubtotal + amountTax;

    subtotalCents += amountSubtotal;
    taxTotalCents += amountTax;
    lineTotalsCents += amountTotal;
  }

  const totalCents =
    typeof input.totalCents === 'number' && Number.isFinite(input.totalCents)
      ? Math.max(0, Math.trunc(input.totalCents))
      : 0;

  const shippingTotalCents =
    typeof input.shippingTotalCents === 'number' &&
    Number.isFinite(input.shippingTotalCents)
      ? Math.max(0, Math.trunc(input.shippingTotalCents))
      : 0;

  const discountTotalCents =
    typeof input.discountTotalCents === 'number' &&
    Number.isFinite(input.discountTotalCents)
      ? Math.max(0, Math.trunc(input.discountTotalCents))
      : 0;

  // Prefer provided webhook fee; otherwise 0 (don’t guess).
  const stripeFeeCents =
    typeof input.stripeFeeCents === 'number' &&
    Number.isFinite(input.stripeFeeCents)
      ? Math.max(0, Math.trunc(input.stripeFeeCents))
      : 0;

  // Prefer provided platform fee; else compute from constant percentage.
  const computedPlatformFee = Math.round(
    totalCents * (PLATFORM_FEE_PERCENTAGE / 100)
  );
  const platformFeeCents =
    typeof input.platformFeeCents === 'number' &&
    Number.isFinite(input.platformFeeCents)
      ? Math.max(0, Math.trunc(input.platformFeeCents))
      : Math.max(0, computedPlatformFee);

  // Seller net = total - platform fee - Stripe fee
  const sellerNetCents = Math.max(
    0,
    totalCents - platformFeeCents - stripeFeeCents
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
