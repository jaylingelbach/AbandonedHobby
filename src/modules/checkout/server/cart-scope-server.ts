import { cookies } from 'next/headers';

export const DEFAULT_TENANT = '__global__';
export const ANON_PREFIX = 'anon:';
export const DEVICE_ID_KEY = 'ah_device_id';

/**
 *
 * The tenant is taken from `tenantSlug` (trimmed) or falls back to `DEFAULT_TENANT`.
 * The user identifier is `userId` (trimmed) when provided; otherwise it is `ANON_PREFIX` +
 * the device id read from the server cookie `DEVICE_ID_KEY`, or `'pending'` if that cookie is absent.
 *
 * @param tenantSlug - Optional tenant slug; when empty or missing, `DEFAULT_TENANT` is used
 * @param userId - Optional user id; when empty or missing, an anonymous id (`ANON_PREFIX` + device id or `'pending'`) is used
 * @returns The scope string in the form "<tenant>::<user_identifier>"
 */

export async function buildScopeServer(
  tenantSlug?: string | null,
  userId?: string | null
) {
  const t = (tenantSlug ?? '').trim() || DEFAULT_TENANT;
  const cookieStore = await cookies();
  const idFromCookie = cookieStore.get(DEVICE_ID_KEY)?.value ?? null;
  const anonId = idFromCookie ?? 'pending'; // middleware should have set it; "pending" is a last-resort non-shared placeholder
  const u = (userId ?? '').trim() || `${ANON_PREFIX}${anonId}`;
  return `${t}::${u}`;
}
