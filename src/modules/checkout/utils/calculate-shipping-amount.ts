import { ProductWithShipping } from '../types';

/**
 * Compute the shipping amount for a product in cents when the product uses flat shipping.
 *
 * Chooses the first valid source in this order: `shippingFeeCentsPerUnit` (truncated to an integer),
 * `shippingFlatFeeCents` (truncated to an integer), then `shippingFlatFee` (USD converted and rounded to cents).
 * If the product's `shippingMode` is not `'flat'` or no valid values are present, returns 0. All results are non-negative.
 *
 * @param product - Product with shipping configuration
 * @returns The shipping amount in cents (integer >= 0)
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