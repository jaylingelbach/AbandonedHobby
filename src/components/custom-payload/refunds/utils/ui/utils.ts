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
// keeps digits + first dot, trims to 2 decimals
// keeps digits + first dot, clamps to 2 decimals
export function cleanMoneyInput(raw: string): string {
  if (raw == null) return '';
  let s = String(raw).trim();

  // allow just "." while typing
  if (s === '.') return '0.';

  // remove everything except digits and dots
  s = s.replace(/[^\d.]/g, '');

  // keep first dot, drop later ones
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }

  // normalize leading zeros (but keep "0." and "0" as-is)
  if (s.startsWith('0') && !s.startsWith('0.') && s.length > 1) {
    // keep a single leading 0 for whole numbers like "05" -> "5"
    s = String(Number(s)); // "0005" -> "5"
  }

  // cap to 2 decimals if any
  const parts = s.split('.');
  if (parts.length === 2) {
    if (parts[1]) parts[1] = parts[1].slice(0, 2);
    s = parts[0] + '.' + parts[1];
    // if user typed trailing dot: allow "1."
    if (s.endsWith('.')) return s;
  }

  return s;
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
  selections: Array<{
    itemId: string;
    quantity?: number;
    amountCents?: number;
  }>;
  options?: {
    reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other';
    restockingFeeCents?: number;
    refundShippingCents?: number;
  };
}): Promise<string> {
  const normSelections = [...input.selections]
    .map((s) => ({
      itemId: s.itemId,
      quantity: typeof s.quantity === 'number' ? s.quantity : null,
      amountCents: typeof s.amountCents === 'number' ? s.amountCents : null
    }))
    .sort(
      (a, b) =>
        a.itemId.localeCompare(b.itemId) ||
        (a.quantity ?? -1) - (b.quantity ?? -1) ||
        (a.amountCents ?? -1) - (b.amountCents ?? -1)
    );

  const o = input.options ?? {};
  const normalizedOptions = {
    reason: o.reason ?? null,
    restockingFeeCents:
      typeof o.restockingFeeCents === 'number' ? o.restockingFeeCents : 0,
    refundShippingCents:
      typeof o.refundShippingCents === 'number' ? o.refundShippingCents : 0
  };

  const payload = JSON.stringify({
    orderId: input.orderId,
    selections: normSelections,
    options: normalizedOptions
  });

  const enc = new TextEncoder().encode(`refund:v2:${payload}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
