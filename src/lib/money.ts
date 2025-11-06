// src/lib/money.ts

/**
 * Determines whether the given value is a finite number (not NaN or ±Infinity).
 *
 * @returns `true` if `value` is a finite number, `false` otherwise.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Coerces an unknown value to a finite number or `NaN`.
 *
 * @param value - The value to coerce; numbers are returned unchanged and strings are trimmed and parsed.
 * @param options - Coercion options.
 * @param options.coerceEmptyStringToZero - If `true`, treat an empty or all-whitespace string as `0`; otherwise treat it as `NaN`.
 * @returns A finite number parsed from `value`, or `NaN` if the value cannot be coerced to a finite number.
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
 * Convert a USD value into integer cents using nearest-cent rounding.
 *
 * @param options - Optional settings.
 * @param options.allowNegative - If `true`, negative cent values are preserved; otherwise negative results are clamped to `0`.
 * @returns The resulting integer number of cents rounded to the nearest cent. Returns `0` for non-finite or missing input.
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
 * Convert a USD-formatted string to an integer number of cents.
 *
 * Parses the input string and returns the amount in cents rounded to the nearest cent.
 * If the parsed value is not a finite number, returns 0. An empty or whitespace-only
 * string yields 0 only when `coerceEmptyStringToZero` is true; otherwise it is treated
 * as non-finite and returns 0. Negative results are clamped to 0 unless `allowNegative`
 * is true.
 *
 * @param valueUsd - USD amount as a string, or null/undefined
 * @param options - Conversion options
 * @param options.allowNegative - If true, preserve negative cent values; otherwise clamp negatives to 0
 * @param options.coerceEmptyStringToZero - If true, treat empty or whitespace-only strings as `0`
 * @returns The amount in cents as an integer, rounded to the nearest cent; returns 0 for non-finite input
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
 * Convert a USD value (string or number) into integer cents.
 *
 * @param value - The USD amount as a number, string, null, or undefined
 * @param options - Conversion options
 * @param options.allowNegative - If `true`, negative cent results are preserved; otherwise negative results are clamped to 0
 * @param options.coerceEmptyStringToZero - If `true`, an empty string is treated as `0`; otherwise an empty string is treated as invalid and results in `0`
 * @returns The amount in cents as an integer, rounded to the nearest cent; non-finite or invalid inputs produce `0`
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
 * Converts integer cents to a USD amount (e.g., 1234 → 12.34).
 *
 * Non-finite `cents` values (including `null` or `undefined`) are treated as 0.
 *
 * @returns The USD amount represented by `cents` divided by 100; returns 0 for non-finite inputs.
 */
export function centsToUsdNumber(cents: number | null | undefined): number {
  const value = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return value / 100;
}

/**
 * Calculate the integer-cent sum of an array of values.
 *
 * Non-number or non-finite entries are treated as 0. Fractional numbers are truncated toward 0 before summing.
 *
 * @param values - Array of values to sum (non-numeric entries are ignored)
 * @returns The total sum in cents as an integer
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
 * Convert a value representing cents into an integer number of cents.
 *
 * Coerces the input to a finite number, truncates toward zero, and (unless `allowNegative` is true) clamps negative results to 0.
 *
 * @param value - The input value to coerce (commonly a number or numeric string). Empty strings produce `NaN` during coercion unless `coerceEmptyStringToZero` is true.
 * @param options - Optional behaviors.
 * @param options.allowNegative - If true, allow negative integer cents; otherwise negative results are clamped to 0.
 * @param options.coerceEmptyStringToZero - If true, treat an empty string as `0` during coercion.
 * @returns The resulting integer number of cents; returns `0` when the input cannot be coerced to a finite number.
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
 * Converts an input to an integer number of cents, returning `NaN` when the input cannot be coerced to a finite number.
 *
 * Truncates fractional cents toward zero. If `allowNegative` is false or omitted, negative results are clamped to 0.
 *
 * @param options - Configuration options
 * @param options.allowNegative - If true, negative cent values are preserved; otherwise negatives are clamped to 0
 * @param options.coerceEmptyStringToZero - If true, an empty string is treated as `0` when coercing the input
 * @returns `NaN` if the input cannot be coerced to a finite number; otherwise the integer number of cents (truncated toward zero), with negatives clamped to 0 unless `allowNegative` is true
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
