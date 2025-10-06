/** Clamp to an integer between [minimum, maximum] */
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

/** Sanitize a money input to at most 2 decimals, digits + one dot */
export function cleanMoneyInput(raw: string): string {
  const trimmed = raw.trim().replace(/[^\d.]/g, '');
  const parts = trimmed.split('.');
  const dollars = parts[0] ?? '';
  const cents = (parts[1] ?? '').slice(0, 2);
  return cents.length > 0 ? `${dollars}.${cents}` : dollars;
}

/** Parse "12.34" → 1234; invalid/empty → 0 */
export function parseMoneyToCents(raw: string): number {
  if (!raw) return 0;
  const cleaned = cleanMoneyInput(raw);
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}

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
