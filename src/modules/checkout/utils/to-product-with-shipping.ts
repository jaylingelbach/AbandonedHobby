import { usdToCents, isFiniteNumber } from '@/lib/money';
import type { ProductWithShipping, ShippingModeUnion } from '../types';

/**
 * Transforms unknown product data into a ProductWithShipping object.
 * - Normalizes cents fields (trunc) and USD (round via usdToCents).
 * - Legacy "flat" fallback ONLY when flat-fee fields exist (NOT per-unit).
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

  // Legacy guard: only treat true flat-fee fields as legacy "flat"
  const hasLegacyFlat =
    isFiniteNumber(rawFlatFeeCents) || isFiniteNumber(rawFlatFeeUsd);

  // NOTE: do not use per-unit to force 'flat' here; rely on explicit mode for per-unit setups
  const mode: ShippingModeUnion =
    rawMode === 'free' || rawMode === 'flat' || rawMode === 'calculated'
      ? rawMode
      : hasLegacyFlat
        ? 'flat'
        : 'free';

  // Optional: surface a dev warning if per-unit is set but mode is missing/legacy-free
  if (
    process.env.NODE_ENV === 'development' &&
    perUnitCents !== undefined &&
    !hasLegacyFlat &&
    (rawMode === undefined || rawMode === null)
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[toProductWithShipping] Per-unit fee present but shippingMode missing; defaulting to "free". ' +
        'Downstream calculators will ignore per-unit unless shippingMode is "flat".'
    );
  }

  return {
    shippingMode: mode,
    shippingFeeCentsPerUnit: perUnitCents,
    shippingFlatFeeCents: flatFeeCents
  };
}
