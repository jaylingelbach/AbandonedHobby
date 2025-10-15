const DEFAULT_TENANT = '__global__';
const ANON_PREFIX = 'anon:';
const DEVICE_ID_KEY = 'ah_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const gen =
    (typeof crypto !== 'undefined' &&
      'randomUUID' in crypto &&
      crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`;
  localStorage.setItem(DEVICE_ID_KEY, gen);
  return gen;
}

export function buildScope(tenantSlug?: string | null, userId?: string | null) {
  const t = (tenantSlug ?? '').trim() || DEFAULT_TENANT;
  const u = (userId ?? '').trim() || `${ANON_PREFIX}${getOrCreateDeviceId()}`;
  return `${t}::${u}`;
}
