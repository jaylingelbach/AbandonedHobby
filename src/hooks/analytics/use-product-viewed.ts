'use client';
import { useEffect, useMemo } from 'react';
import { capture } from '@/lib/analytics/ph-utils/ph';

type ProductViewedPayload = {
  id: string;
  sellerId?: string;
  price?: number;
  currency?: string; // optional
  tenantSlug?: string;
};

export function useProductViewed(product: ProductViewedPayload) {
  const eventPayload = useMemo(
    () => ({
      productId: product.id,
      sellerId: product.sellerId,
      price: product.price,
      currency: product.currency ?? 'USD',
      tenantSlug: product.tenantSlug
    }),
    [
      product?.id,
      product.sellerId,
      product.price,
      product.currency,
      product.tenantSlug
    ]
  );
  useEffect(() => {
    if (!product?.id) return;

    capture('productViewed', eventPayload);
  }, [eventPayload, product?.id]);
}
