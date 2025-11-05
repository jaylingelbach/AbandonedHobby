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

  // 1) Most authoritative: explicit cents per unit snapshot
  const centsPerUnit = product.shippingFeeCentsPerUnit;
  if (typeof centsPerUnit === 'number' && Number.isFinite(centsPerUnit)) {
    return Math.max(0, Math.trunc(centsPerUnit));
  }

  // 2) Next: a flat fee already expressed in cents
  const flatCents = product.shippingFlatFeeCents;
  if (typeof flatCents === 'number' && Number.isFinite(flatCents)) {
    return Math.max(0, Math.trunc(flatCents));
  }

  // 3) Fallback: USD flat fee that must be converted to cents
  const flatUsd = product.shippingFlatFee;
  if (typeof flatUsd === 'number' && Number.isFinite(flatUsd)) {
    return Math.max(0, Math.round(flatUsd * 100));
  }

  return 0;
}
