import { track } from '@/lib/analytics';
import { usdNumberToCents } from '@/lib/money';

export interface CartLineForAnalytics {
  productId: string;
  quantity: number;
  price?: number | null;
}

/**
 * Best-effort "cart updated" tracker.
 *
 * Sends:
 * - itemCount: total units in cart
 * - quantityByProductId: { [productId]: quantity }
 * - subtotalCents: sum(unitAmountCents * quantity) when provided
 * - tenantSlug for grouping
 * - userid is managed by the analytics-identity-bridge.tsx file
 */
export function trackCartUpdated(args: {
  tenantSlug?: string | null;
  lines: CartLineForAnalytics[];
  currency?: string;
}): void {
  const { tenantSlug, lines, currency } = args;

  const quantityByProductId: Record<string, number> = {};
  let itemCount = 0;
  let subtotalCents = 0;

  let hasPriceData = false;
  for (const line of lines) {
    const rawId = line.productId;
    const productId = typeof rawId === 'string' ? rawId.trim() : '';
    const priceCents = usdNumberToCents(line.price);
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
      typeof line.price === 'number' &&
      Number.isFinite(priceCents) &&
      line.price >= 0
    ) {
      hasPriceData = true;
      subtotalCents += Math.round(priceCents * safeQty);
    }
  }

  // Nothing meaningful to send
  if (itemCount <= 0 && Object.keys(quantityByProductId).length === 0) {
    return;
  }

  track('cartUpdated', {
    tenantSlug: tenantSlug ?? undefined,
    // userId is intentionally omitted: PostHog identity comes from AnalyticsIdentityBridge
    itemCount,
    quantityByProductId,
    ...(hasPriceData && {
      subtotalCents,
      currency: (currency ?? 'USD').toUpperCase()
    })
  });
}
