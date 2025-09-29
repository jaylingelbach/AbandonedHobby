import { OrderForBuyer } from './types';
import { isObjectRecord } from '@/lib/utils';

type Dict = Record<string, unknown>;
type StringDict = Record<string, unknown>;

function getString(obj: StringDict, key: string): string | undefined {
  const v = obj[key];
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  return undefined;
}

function hasNestedAddress(v: Dict): v is Dict & { address: Dict } {
  const maybe = (v as { address?: unknown }).address;
  return isObjectRecord(maybe);
}

/**
 * Produces a compact, multi-line mailing address string.
 * Accepts either your flat `OrderForBuyer['shipping']` shape or a nested shape
 * like Stripe's `{ address: { line1, city, ... }, name }`.
 */

export function compactAddress(
  addr?:
    | OrderForBuyer['shipping']
    | (Record<string, unknown> & { address?: Record<string, unknown> | null })
): string {
  if (!isObjectRecord(addr)) return '';

  // Prefer nested `address` object when present and well-formed.
  const base: Dict = hasNestedAddress(addr) ? addr.address : addr;

  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const fromBase = getString(base, k);
      if (fromBase) return fromBase;
      const fromRoot = getString(addr, k);
      if (fromRoot) return fromRoot;
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

  const cityState = [city, state].filter(Boolean).join(', ');
  const cityLine =
    cityState + (postalCode ? (cityState ? ` ${postalCode}` : postalCode) : '');

  return [name, line1, line2, cityLine, country]
    .filter((s) => s && s.trim().length > 0)
    .join('\n');
}
