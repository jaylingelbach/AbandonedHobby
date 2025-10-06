/**
 * Clamp a numeric value to an integer within an inclusive range.
 *
 * @param value - The input number; fractional values are truncated toward zero before clamping. If `value` is not finite, `minimum` is returned.
 * @param minimum - Inclusive lower bound of the range.
 * @param maximum - Inclusive upper bound of the range.
 * @returns The truncated integer constrained to the inclusive range `[minimum, maximum]`.
 * @throws Error if `minimum` is greater than `maximum`.
 */
export function clampInteger(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (minimum > maximum) {
    throw new Error(
      `Invalid range: minimum (${minimum}) > maximum (${maximum})`
    );
  }
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

/**
 * Normalize a monetary input string to digits with an optional decimal point and up to two fractional digits.
 *
 * @param raw - The input string possibly containing currency symbols, spaces, or other non-numeric characters
 * @returns A string containing only digits and at most one decimal point with up to two digits after it; returns an empty string if no digits are present
 */
export function cleanMoneyInput(raw: string): string {
  const trimmed = raw.trim().replace(/[^\d.]/g, '');
  const parts = trimmed.split('.');
  const dollars = parts[0] ?? '';
  const cents = (parts[1] ?? '').slice(0, 2);
  return cents.length > 0 ? `${dollars}.${cents}` : dollars;
}

/**
 * Convert a monetary string into an integer number of cents.
 *
 * @param raw - The monetary input string (e.g., "12.34"); may contain extraneous characters and decimals.
 * @returns The amount in cents as an integer; returns `0` for empty, invalid, non-finite, or negative inputs.
 */
export function parseMoneyToCents(raw: string): number {
  if (!raw) return 0;
  const cleaned = cleanMoneyInput(raw);
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}

/**
 * Generate a deterministic idempotency key for a refund payload.
 *
 * @param input - Object with refund data. `orderId` must be a non-empty string. `selections` must be a non-empty array of `{ itemId, quantity }`; selections are sorted deterministically by `itemId` (locale 'en-US') then `quantity`. `options` may include `reason` (one of the allowed literals), `restockingFeeCents`, and `refundShippingCents`; `reason` defaults to `null` when absent, and numeric fee fields default to `0`.
 * @returns A lowercase hexadecimal string containing the SHA-256 digest of the canonical payload prefixed with `refund:v2:`.
 * @throws Error when `orderId` is missing or empty.
 * @throws Error when `selections` is missing or empty.
 */
export async function buildClientIdempotencyKeyV2(input: {
  orderId: string;
  selections: Array<{ itemId: string; quantity: number }>;
  options?: {
    reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other';
    restockingFeeCents?: number;
    refundShippingCents?: number;
  };
}): Promise<string> {
  if (!input.orderId?.trim()) {
    throw new Error('orderId is required');
  }
  if (!input.selections?.length) {
    throw new Error('selections array cannot be empty');
  }
  const sortedSelections = [...input.selections].sort(
    (a, b) =>
      a.itemId.localeCompare(b.itemId, 'en-US') || a.quantity - b.quantity
  );
  const o = input.options ?? {};
  const normalized = {
    reason: o.reason ?? null,
    restockingFeeCents:
      typeof o.restockingFeeCents === 'number' ? o.restockingFeeCents : 0,
    refundShippingCents:
      typeof o.refundShippingCents === 'number' ? o.refundShippingCents : 0,
  };
  const payload = JSON.stringify({
    orderId: input.orderId,
    selections: sortedSelections,
    options: normalized,
  });
  const enc = new TextEncoder().encode(`refund:v2:${payload}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}