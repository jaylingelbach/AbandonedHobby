import { ProductWithShipping, ShippingModeUnion } from '../types';

export function toProductWithShipping(
  raw: unknown
): ProductWithShipping | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const rawMode = record['shippingMode'];
  const rawPerUnitCents = record['shippingFeeCentsPerUnit'];
  const rawFlatFeeCents = record['shippingFlatFeeCents'];
  const rawFlatFeeUsd = record['shippingFlatFee'];

  const perUnitCents =
    typeof rawPerUnitCents === 'number' && Number.isFinite(rawPerUnitCents)
      ? Math.max(0, Math.trunc(rawPerUnitCents))
      : undefined;

  const flatFeeCents =
    typeof rawFlatFeeCents === 'number' && Number.isFinite(rawFlatFeeCents)
      ? Math.max(0, Math.trunc(rawFlatFeeCents))
      : typeof rawFlatFeeUsd === 'number' && Number.isFinite(rawFlatFeeUsd)
        ? Math.max(0, Math.round(rawFlatFeeUsd * 100))
        : undefined;

  const hasLegacyFlat =
    typeof rawFlatFeeCents === 'number' ||
    typeof rawFlatFeeUsd === 'number' ||
    typeof rawPerUnitCents === 'number';

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
