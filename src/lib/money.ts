// src/lib/money.ts

/**
 * Narrowly checks that a value is a finite number (not NaN/Infinity).
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Internal: coerce unknown to number or NaN.
 * - For strings, trims whitespace; empty string returns NaN unless
 *   coerceEmptyStringToZero=true.
 * - For non-string and non-number, returns NaN.
 */
function coerceToNumber(
  value: unknown,
  options?: { coerceEmptyStringToZero?: boolean }
): number {
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return options?.coerceEmptyStringToZero ? 0 : Number.NaN;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

/**
 * Convert a USD number (e.g., 12.34) to integer cents using nearest-cent rounding.
 * Negatives are clamped to 0 unless allowNegative=true.
 */
export function usdNumberToCents(
  valueUsd: number | null | undefined,
  options?: { allowNegative?: boolean }
): number {
  if (!isFiniteNumber(valueUsd)) return 0;
  const cents = Math.round(valueUsd * 100);
  return options?.allowNegative ? cents : Math.max(0, cents);
}

/**
 * Convert a USD string (e.g., "12.34") to cents with nearest-cent rounding.
 * Empty/whitespace string returns 0 only if coerceEmptyStringToZero=true.
 */
export function usdStringToCents(
  valueUsd: string | null | undefined,
  options?: { allowNegative?: boolean; coerceEmptyStringToZero?: boolean }
): number {
  const numeric = coerceToNumber(valueUsd, {
    coerceEmptyStringToZero: options?.coerceEmptyStringToZero
  });
  if (!Number.isFinite(numeric)) return 0;
  return usdNumberToCents(numeric, { allowNegative: options?.allowNegative });
}

/**
 * Generic USD converter that accepts string or number.
 */
export function usdToCents(
  value: string | number | null | undefined,
  options?: { allowNegative?: boolean; coerceEmptyStringToZero?: boolean }
): number {
  if (typeof value === 'string') {
    return usdStringToCents(value, options);
  }
  return usdNumberToCents(value as number | null | undefined, {
    allowNegative: options?.allowNegative
  });
}

/**
 * Convert integer cents back to a USD number (e.g., 1234 → 12.34).
 */
export function centsToUsdNumber(cents: number | null | undefined): number {
  const value = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return value / 100;
}

/**
 * Sum an array of cent values safely (clamps non-numbers to 0).
 * Fractions are truncated toward 0.
 */
export function sumCents(values: Array<unknown>): number {
  let total = 0;
  for (const value of values) {
    total +=
      typeof value === 'number' && Number.isFinite(value)
        ? Math.trunc(value)
        : 0;
  }
  return total;
}

/**
 * Coerces a value representing **cents** into an integer number of cents.
 * - Strings are parsed with trimming; empty string → NaN unless coerceEmptyStringToZero=true.
 * - Invalid values become 0.
 * - Fractions are truncated toward 0.
 * - Negatives are clamped to 0 unless allowNegative=true.
 */
export function toIntCents(
  value: unknown,
  options?: { allowNegative?: boolean; coerceEmptyStringToZero?: boolean }
): number {
  const numeric = coerceToNumber(value, {
    coerceEmptyStringToZero: options?.coerceEmptyStringToZero
  });
  if (!Number.isFinite(numeric)) return 0;
  const truncated = Math.trunc(numeric);
  if (options?.allowNegative) return truncated;
  return Math.max(0, truncated);
}

/**
 * Like toIntCents, but returns NaN when the input cannot be coerced to a finite number.
 * Useful when the caller wants to detect "no value" vs. "0".
 */
export function toIntCentsOrNaN(
  value: unknown,
  options?: { allowNegative?: boolean; coerceEmptyStringToZero?: boolean }
): number {
  const numeric = coerceToNumber(value, {
    coerceEmptyStringToZero: options?.coerceEmptyStringToZero
  });
  if (!Number.isFinite(numeric)) return Number.NaN;
  const truncated = Math.trunc(numeric);
  if (options?.allowNegative) return truncated;
  return Math.max(0, truncated);
}
