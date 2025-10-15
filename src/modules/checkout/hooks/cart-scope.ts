'use client'; // this file can be imported from client hooks/components
export const DEFAULT_TENANT = '__global__';
export const ANON_PREFIX = 'anon:';
export const DEVICE_ID_KEY = 'ah_device_id';

/**
 * Obtain a stable client device identifier, creating and persisting one if necessary.
 *
 * If executed in a browser, returns an existing device id from a cookie (preferred) or from
 * localStorage; if none exists, generates a new id, stores it in localStorage, and returns it.
 * If localStorage access or generation fails, returns a non-persistent timestamp-random id.
 * If executed on the server, throws an error in non-production to reveal misuse; in production
 * it returns the placeholder string `'pending'`.
 *
 * @returns The device identifier string: the cookie value if present, otherwise a stored or newly
 * generated id; may be `'pending'` when called on the server in production, or a timestamp-random
 * string if storage access fails.
 * @throws Error when called on the server in non-production environments.
 */
export function getOrCreateDeviceIdClient(): string {
  if (typeof window === 'undefined') {
    // Make misuse obvious in dev instead of silently colliding carts.
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('getOrCreateDeviceIdClient() called on server');
    }
    // In prod, return a non-persistent placeholder (still better than "server")
    return 'pending';
  }

  // Prefer cookie if present (from middleware) to keep ID stable across tabs
  const viaCookie =
    document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${DEVICE_ID_KEY}=`))
      ?.split('=')[1] ?? null;

  if (viaCookie) return viaCookie;

  // Fallback to localStorage (should rarely happen thanks to middleware)
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const gen =
      (typeof crypto !== 'undefined' &&
        'randomUUID' in crypto &&
        crypto.randomUUID()) ||
      `${Date.now()}-${Math.random()}`;
    localStorage.setItem(DEVICE_ID_KEY, gen);
    return gen;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

/**
 * Build a client scope identifier combining tenant and user (or anonymous device) identity.
 *
 * @param tenantSlug - Optional tenant slug; when empty or whitespace, uses the default tenant.
 * @param userId - Optional user identifier; when empty or whitespace, falls back to an anonymous id prefixed with `anon:` derived from the device identifier.
 * @returns The scope string in the form `tenant::user` (e.g., `my-tenant::user-123` or `__global__::anon:device-xyz`)
 */
export function buildScopeClient(
  tenantSlug?: string | null,
  userId?: string | null
) {
  const t = (tenantSlug ?? '').trim() || DEFAULT_TENANT;
  const u =
    (userId ?? '').trim() || `${ANON_PREFIX}${getOrCreateDeviceIdClient()}`;
  return `${t}::${u}`;
}