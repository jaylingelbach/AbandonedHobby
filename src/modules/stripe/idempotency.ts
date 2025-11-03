import crypto from 'node:crypto';

/** Narrow check for plain objects ({} or Object.create(null)) */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deterministically stringify an unknown value with:
 * - Sorted object keys
 * - Stable Map/Set handling
 * - Date -> ISO string
 * - BigInt -> string
 * - NaN/±Infinity -> null
 * - Functions/Symbols -> string tag
 * - Circular reference protection via WeakSet
 * - Drops undefined properties to remain stable
 */
function toDeterministicJson(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): string {
  // Primitives & null
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    // Normalize NaN/Infinity to null for stability
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (typeof value === 'bigint') {
    // Encode as string to avoid JSON bigint issues
    return JSON.stringify(value.toString());
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    // Encode as tagged string to preserve identity without blowing up
    return JSON.stringify(String(value));
  }

  // Dates
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  // RegExp
  if (value instanceof RegExp) {
    return JSON.stringify(value.toString());
  }

  // Map (as sorted array of [key, val])
  if (value instanceof Map) {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    // Convert keys to strings deterministically
    const entries: Array<[string, unknown]> = [];
    for (const [k, v] of value.entries()) {
      entries.push([String(k), v]);
    }
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const mapped = entries.map(
      ([k, v]) => `[${JSON.stringify(k)},${toDeterministicJson(v, seen)}]`
    );
    return `[${mapped.join(',')}]`;
  }

  // Set (as sorted array of items by their deterministic JSON)
  if (value instanceof Set) {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    const items: string[] = [];
    for (const item of value.values()) {
      items.push(toDeterministicJson(item, seen));
    }
    items.sort(); // already deterministic strings
    return `[${items.join(',')}]`;
  }

  // Arrays
  if (Array.isArray(value)) {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    // Keep array order; drop undefined to be stable
    const mapped = value
      .filter((item) => item !== undefined)
      .map((item) => toDeterministicJson(item, seen));
    return `[${mapped.join(',')}]`;
  }

  // Plain objects (sorted keys)
  if (isPlainObject(value)) {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [String(k), v] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const mapped = entries.map(
      ([key, val]) => `${JSON.stringify(key)}:${toDeterministicJson(val, seen)}`
    );
    return `{${mapped.join(',')}}`;
  }

  // Fallback: stringify object identity as string
  return JSON.stringify(String(value));
}

/**
 * Build a compact, stable idempotency key from an arbitrary payload.
 * - We hash the deterministic JSON and keep a short prefix for Stripe’s limits.
 * - Optional salt lets you “bucket” requests (e.g., time window or attempt id).
 */
export function buildIdempotencyKey(args: {
  prefix: 'checkout' | 'pi' | 'refund';
  actorId: string;
  tenantId: string;
  payload: unknown; // intentionally wide; normalized internally
  salt?: string;
}): string {
  const deterministicJson = toDeterministicJson(args.payload, new WeakSet());
  const encode = (s: string) => encodeURIComponent(s);
  const actor = encode(args.actorId);
  const tenant = encode(args.tenantId);
  const salt = args.salt ? encode(args.salt) : undefined;

  const digest = crypto
    .createHash('sha256')
    .update(deterministicJson)
    .digest('hex')
    .slice(0, 24);

  const key = `${args.prefix}:${actor}:${tenant}:${digest}${
    salt ? `:${salt}` : ''
  }`;
  if (key.length > 255) {
    console.warn(`Idempotency key truncated: ${key.slice(0, 50)}...`);
    return key.slice(0, 255);
  }
  return key;
}
