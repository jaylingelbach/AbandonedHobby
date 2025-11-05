import { usdToCents, isFiniteNumber } from '@/lib/money';
import type { ProductWithShipping, ShippingModeUnion } from '../types';

/**
 * Transforms unknown product data into a ProductWithShipping object.
 *
 * Handles legacy fields:
 * - Converts `shippingFlatFee` (USD) to cents
 * - Falls back to `shippingFlatFeeCents` or `shippingFeeCentsPerUnit`
 *
 * Mode defaults:
 * - If explicit mode is set, uses that
 * - If any legacy fee field exists, defaults to 'flat'
 * - Otherwise defaults to 'free'
 *
 * @param raw - Unknown product data to transform
 * @returns ProductWithShipping object or null if input is invalid
 */

export function toProductWithShipping(
  raw: unknown
): ProductWithShipping | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const record = raw as Record<string, unknown>;

  const rawMode = record['shippingMode'];
  const rawPerUnitCents = record['shippingFeeCentsPerUnit'];
  const rawFlatFeeCents = record['shippingFlatFeeCents'];
  const rawFlatFeeUsd = record['shippingFlatFee'];

  // Normalize cents-per-unit (already cents)
  const perUnitCents = isFiniteNumber(rawPerUnitCents)
    ? Math.max(0, Math.trunc(rawPerUnitCents))
    : undefined;

  // Normalize a flat amount in cents (prefer cents field, fallback to USD)
  const flatFeeCents = isFiniteNumber(rawFlatFeeCents)
    ? Math.max(0, Math.trunc(rawFlatFeeCents))
    : isFiniteNumber(rawFlatFeeUsd)
      ? Math.max(0, usdToCents(rawFlatFeeUsd))
      : undefined;

  // Legacy guard: if any finite flat config exists but mode is missing, treat as 'flat'
  const hasLegacyFlat =
    isFiniteNumber(rawFlatFeeCents) ||
    isFiniteNumber(rawFlatFeeUsd) ||
    isFiniteNumber(rawPerUnitCents);

  const mode: ShippingModeUnion =
    rawMode === 'free' || rawMode === 'flat' || rawMode === 'calculated'
      ? rawMode
      : hasLegacyFlat
        ? 'flat'
        : 'free';

  return {
    shippingMode: mode,
    shippingFeeCentsPerUnit: perUnitCents,
    shippingFlatFeeCents: flatFeeCents
  };
}
