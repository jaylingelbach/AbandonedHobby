// Centralized, safe money helpers (USD). No `any`.

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Convert a USD number (e.g., 12.34) to integer cents (1234) using nearest-cent rounding.
 * Guards against NaN/Infinity and negatives are clamped to 0 unless allowNegative=true.
 */
export function usdNumberToCents(
  valueUsd: number | null | undefined,
  options?: { allowNegative?: boolean }
): number {
  if (!isFiniteNumber(valueUsd)) return 0;
  const cents = Math.round(valueUsd * 100); // prefer rounding over truncation
  return options?.allowNegative ? cents : Math.max(0, cents);
}

/**
 * Convert a USD string (e.g., "12.34") to cents with nearest-cent rounding.
 */
export function usdStringToCents(
  valueUsd: string | null | undefined,
  options?: { allowNegative?: boolean }
): number {
  if (typeof valueUsd !== 'string') return 0;
  const parsed = Number(valueUsd);
  return usdNumberToCents(Number.isFinite(parsed) ? parsed : 0, options);
}

/** Generic converter that accepts string or number. */
export function usdToCents(
  value: string | number | null | undefined,
  options?: { allowNegative?: boolean }
): number {
  return typeof value === 'string'
    ? usdStringToCents(value, options)
    : usdNumberToCents(value, options);
}

/** Convert integer cents back to a USD number (e.g., 1234 → 12.34). */
export function centsToUsdNumber(cents: number | null | undefined): number {
  const v = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return v / 100;
}

/** Sum an array of cent values safely (clamps non-numbers to 0). */
export function sumCents(values: Array<unknown>): number {
  let total = 0;
  for (const v of values) {
    total += typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
  }
  return total;
}
