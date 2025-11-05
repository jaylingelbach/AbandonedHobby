import { ProductWithShipping, ShippingModeUnion } from '../types';

export function toProductWithShipping(
  raw: unknown
): ProductWithShipping | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const record = raw as Record<string, unknown>;

  // Mode: coerce to a safe enum-like value (default 'free')
  const rawMode = record['shippingMode'];
  const mode: ShippingModeUnion =
    rawMode === 'free' || rawMode === 'flat' || rawMode === 'calculated'
      ? rawMode
      : 'free';

  // Cents snapshot (already-per-unit, integer-ish)
  const rawPerUnitCents = record['shippingFeeCentsPerUnit'];
  const shippingFeeCentsPerUnit =
    typeof rawPerUnitCents === 'number' && Number.isFinite(rawPerUnitCents)
      ? Math.max(0, Math.trunc(rawPerUnitCents))
      : undefined;

  // Flat fee (server may store either dollars or cents depending on version)
  // Prefer *_Cents if present; otherwise accept dollar field and convert.
  const rawFlatFeeCents = record['shippingFlatFeeCents'];
  const rawFlatFeeDollars = record['shippingFlatFee'];

  let shippingFlatFeeCents: number | undefined = undefined;

  if (typeof rawFlatFeeCents === 'number' && Number.isFinite(rawFlatFeeCents)) {
    shippingFlatFeeCents = Math.max(0, Math.trunc(rawFlatFeeCents));
  } else if (
    typeof rawFlatFeeDollars === 'number' &&
    Number.isFinite(rawFlatFeeDollars)
  ) {
    shippingFlatFeeCents = Math.max(0, Math.round(rawFlatFeeDollars * 100));
  }

  // If everything is default/undefined AND mode resolves to 'free', still return a valid object
  return {
    shippingMode: mode,
    shippingFeeCentsPerUnit,
    shippingFlatFeeCents
  };
}
