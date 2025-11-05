import { ProductWithShipping } from '../types';

export function calculateShippingAmount(product: ProductWithShipping): number {
  const mode = product.shippingMode ?? 'free';
  if (mode !== 'flat') return 0;

  const centsFromSnapshot = product.shippingFeeCentsPerUnit;
  if (
    typeof centsFromSnapshot === 'number' &&
    Number.isFinite(centsFromSnapshot)
  ) {
    return Math.max(0, Math.trunc(centsFromSnapshot));
  }

  const usdFromFlat = product.shippingFlatFeeCents;
  if (typeof usdFromFlat === 'number' && Number.isFinite(usdFromFlat)) {
    return Math.max(0, Math.round(usdFromFlat * 100));
  }

  return 0;
}
