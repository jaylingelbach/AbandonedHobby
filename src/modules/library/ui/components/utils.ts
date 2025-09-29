import { OrderForBuyer } from './types';
import { isObjectRecord } from '@/lib/utils';

type Dict = Record<string, unknown>;
type StringDict = Record<string, unknown>;

/**
 * Retrieve a trimmed, non-empty string value for a given key from an object.
 *
 * @param obj - The source object to read the property from
 * @param key - The property key to look up on `obj`
 * @returns The trimmed string value if the property exists and is not empty after trimming, `undefined` otherwise
 */
function getString(obj: StringDict, key: string): string | undefined {
  const v = obj[key];
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  return undefined;
}

/**
 * Type guard that determines whether a value has an `address` property that is an object record.
 *
 * @param v - The value to inspect for a nested `address` object.
 * @returns `true` if `v.address` exists and is an object record, `false` otherwise.
 */
function hasNestedAddress(v: Dict): v is Dict & { address: Dict } {
  const maybe = (v as { address?: unknown }).address;
  return isObjectRecord(maybe);
}

/**
 * Create a compact, multi-line mailing address string from different address shapes.
 *
 * Accepts either a flat OrderForBuyer['shipping'] shape or an object with an optional nested
 * `address` record (e.g., Stripe-style `{ address: { ... }, name }`), and prefers nested fields
 * when present.
 *
 * @param addr - Address-like object (flat shipping shape or object containing an `address` record)
 * @returns A newline-separated address string composed of name, address lines, city/state/postal, and country; returns an empty string when the input is not an object or contains no addressable fields.
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
