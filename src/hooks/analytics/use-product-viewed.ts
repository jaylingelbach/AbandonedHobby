'use client';
import { useEffect } from 'react';
import { capture } from '@/lib/analytics/ph-utils/ph';

type ProductViewedPayload = {
  id: string;
  sellerId?: string;
  price?: number;
  currency?: string; // optional
  tenantSlug?: string;
};

export function useProductViewed(product: ProductViewedPayload) {
  useEffect(() => {
    if (!product?.id) return;

    capture('productViewed', {
      productId: product.id,
      sellerId: product.sellerId,
      price: product.price,
      currency: product.currency ?? 'USD',
      tenantSlug: product.tenantSlug
    });
  }, [product?.id]);
}
