import { track } from '@/lib/analytics';

export interface CartLineForAnalytics {
  productId: string;
  quantity: number;
  unitAmountCents?: number | null;
}

/**
 * Best-effort "cart updated" tracker.
 *
 * Sends:
 * - itemCount: total units in cart
 * - quantityByProductId: { [productId]: quantity }
 * - subtotalCents: sum(unitAmountCents * quantity) when provided
 * - tenantSlug / userId for grouping
 */
export function trackCartUpdated(args: {
  tenantSlug?: string | null;
  userId?: string | null;
  lines: CartLineForAnalytics[];
  currency?: string;
}): void {
  const { tenantSlug, userId, lines, currency } = args;

  const quantityByProductId: Record<string, number> = {};
  let itemCount = 0;
  let subtotalCents = 0;

  let hasPriceData = false;
  for (const line of lines) {
    const rawId = line.productId;
    const productId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!productId) continue;

    const rawQty = line.quantity;
    const safeQty =
      typeof rawQty === 'number' && Number.isFinite(rawQty) && rawQty > 0
        ? Math.trunc(rawQty)
        : 0;

    if (safeQty <= 0) continue;

    quantityByProductId[productId] =
      (quantityByProductId[productId] ?? 0) + safeQty;
    itemCount += safeQty;

    if (
      typeof line.unitAmountCents === 'number' &&
      Number.isFinite(line.unitAmountCents) &&
      line.unitAmountCents >= 0
    ) {
      hasPriceData = true;
      subtotalCents += Math.round(line.unitAmountCents * safeQty);
    }
  }

  // Nothing meaningful to send
  if (itemCount <= 0 && Object.keys(quantityByProductId).length === 0) {
    return;
  }

  track('cartUpdated', {
    tenantSlug: tenantSlug ?? undefined,
    userId: userId ?? undefined,
    itemCount,
    quantityByProductId,
    ...(hasPriceData && {
      subtotalCents,
      currency: (currency ?? 'USD').toUpperCase()
    })
  });
}
