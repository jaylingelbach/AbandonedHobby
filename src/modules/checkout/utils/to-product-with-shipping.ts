import { usdToCents, toIntCents, isFiniteNumber } from '@/lib/money';
import type { ProductWithShipping, ShippingModeUnion } from '../types';

/**
 * Transforms unknown product data into a ProductWithShipping object.
 * - Normalizes cents fields (trunc) and USD (round via usdToCents).
 * - Accepts string/number for legacy/admin inputs; empty strings coerce to 0 here.
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

  // Normalize cents-per-unit (already cents). Allow strings; coerce "" -> 0 here.
  const perUnitCentsCandidate = toIntCents(rawPerUnitCents, {
    coerceEmptyStringToZero: true
  });
  const perUnitCents =
    perUnitCentsCandidate > 0 ? perUnitCentsCandidate : undefined;

  // Normalize a flat amount in cents (prefer cents field, fallback to USD).
  const flatCentsFromCents = toIntCents(rawFlatFeeCents, {
    coerceEmptyStringToZero: true
  });
  const flatCentsFromUsd = usdToCents(
    rawFlatFeeUsd as string | number | null | undefined,
    { coerceEmptyStringToZero: true }
  );
  const flatFeeCents =
    flatCentsFromCents > 0
      ? flatCentsFromCents
      : flatCentsFromUsd > 0
        ? flatCentsFromUsd
        : undefined;

  // Legacy guard: only treat true flat-fee fields as legacy "flat"
  const hasLegacyFlat =
    (isFiniteNumber(rawFlatFeeCents) && flatCentsFromCents > 0) ||
    (typeof rawFlatFeeUsd !== 'undefined' && flatCentsFromUsd > 0);

  // Do NOT let per-unit force 'flat'; require explicit mode or true flat legacy
  const mode: ShippingModeUnion =
    rawMode === 'free' || rawMode === 'flat' || rawMode === 'calculated'
      ? rawMode
      : hasLegacyFlat
        ? 'flat'
        : 'free';

  // Optional dev hint when per-unit exists but mode is missing/legacy-free
  if (
    process.env.NODE_ENV === 'development' &&
    perUnitCents !== undefined &&
    !hasLegacyFlat &&
    (rawMode === undefined || rawMode === null)
  ) {
    console.warn(
      '[toProductWithShipping] Per-unit fee present but shippingMode missing; defaulting to "free". ' +
        'Downstream calculators will ignore per-unit unless shippingMode is "flat".'
    );
  }

  return {
    shippingMode: mode,
    // If mode is free, drop per-unit to avoid misleading downstream math
    shippingFeeCentsPerUnit: mode === 'free' ? undefined : perUnitCents,
    shippingFlatFeeCents: flatFeeCents
  };
}
