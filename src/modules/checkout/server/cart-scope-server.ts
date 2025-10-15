import { cookies } from 'next/headers';

export const DEFAULT_TENANT = '__global__';
export const ANON_PREFIX = 'anon:';
export const DEVICE_ID_KEY = 'ah_device_id';

/**
 * SERVER scope builder.
 * Reads anon id from cookie set by middleware.
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
