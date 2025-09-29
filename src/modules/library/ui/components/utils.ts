import { OrderForBuyer } from './types';

export function compactAddress(
  addr?:
    | OrderForBuyer['shipping']
    | (Record<string, unknown> & { address?: Record<string, unknown> })
): string {
  if (!addr) return '';

  // Accept both flat and nested shapes (e.g., Stripe-like)
  const a = addr as any;
  const base = a.address && typeof a.address === 'object' ? a.address : a;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const candidates = [base?.[k], a?.[k]];
      for (const v of candidates) {
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed.length > 0) return trimmed;
        }
      }
    }
    return '';
  };

  const name = pick('name', 'fullName');
  const line1 = pick('line1', 'address_line1', 'line_1');
  const line2 = pick('line2', 'address_line2', 'line_2');
  const city = pick('city');
  const state = pick('state', 'region', 'province');
  const postalCode = pick('postalCode', 'postal_code', 'zip', 'zipCode');
  const country = pick('country');

  const cityLine =
    [city, state].filter(Boolean).join(', ') +
    (postalCode ? (city || state ? ` ${postalCode}` : postalCode) : '');

  const parts = [name, line1, line2, cityLine, country]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);

  return parts.join('\n');
}
