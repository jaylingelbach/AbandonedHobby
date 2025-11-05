import { ProductWithShipping } from '../types';

/**
 * Calculates the shipping amount for a product.
 *
 * @param product - Product with shipping configuration
 * @returns Shipping amount in cents (non-negative)
 *
 * Priority:
 * 1. Uses shippingFeeCentsPerUnit if valid (truncated to integer)
 * 2. Falls back to shippingFlatFee converted to cents (rounded)
 * 3. Returns 0 if neither is valid or mode is not 'flat'
 */

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
