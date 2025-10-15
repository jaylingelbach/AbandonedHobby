'use client'; // this file can be imported from client hooks/components
export const DEFAULT_TENANT = '__global__';
export const ANON_PREFIX = 'anon:';
export const DEVICE_ID_KEY = 'ah_device_id';

/**
 * CLIENT-ONLY: get or create device id in localStorage.
 * Never called on the server.
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
 * CLIENT scope builder.
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
