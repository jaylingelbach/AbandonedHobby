import { ShippingMode } from '@/modules/orders/types';
import { ShippingSnapshot, TenantMap, UserMap } from './types';
import { toIntCents } from '@/lib/money';

/**
 * Collapse composite tenant keys of the form "tenant::sub" into their base tenant for each user, merging cart data.
 *
 * @param byUser - Map from user keys to tenant maps whose composite tenant keys should be collapsed
 * @returns A new UserMap where composite tenant keys are replaced by their base tenant key. For each base tenant:
 * - `productIds` is the union of all product ID lists (duplicates removed).
 * - `shippingByProductId` and `quantitiesByProductId` are shallow-merged; values from later composite segments override earlier ones on key conflicts.
 */
export function collapseCompositeTenantKeys(byUser: UserMap): UserMap {
  const out: UserMap = {};
  for (const [userKey, tenantMap] of Object.entries(byUser || {})) {
    const merged: TenantMap = {};
    for (const [rawTenant, cart] of Object.entries(tenantMap || {})) {
      const cleanTenant = rawTenant.includes('::')
        ? rawTenant.split('::')[0]
        : rawTenant;
      if (!cleanTenant) continue;

      const prev = merged[cleanTenant];

      const prevIds = prev?.productIds ?? [];
      const nextIds = Array.from(
        new Set([...(prevIds ?? []), ...(cart?.productIds ?? [])])
      );

      const prevShip = prev?.shippingByProductId ?? {};
      const nextShip = {
        ...prevShip,
        ...(cart?.shippingByProductId ?? {})
      };

      const prevQty = prev?.quantitiesByProductId ?? {};
      const nextQty = {
        ...prevQty,
        ...(cart?.quantitiesByProductId ?? {})
      };

      merged[cleanTenant] = {
        productIds: nextIds,
        ...(Object.keys(nextShip).length > 0
          ? { shippingByProductId: nextShip }
          : {}),
        ...(Object.keys(nextQty).length > 0
          ? { quantitiesByProductId: nextQty }
          : {})
      };
    }
    out[userKey] = merged;
  }
  return out;
}

/**
 * Normalize a shipping mode and optional fee into a ShippingSnapshot suitable for storage.
 *
 * @param mode - Requested shipping mode; values other than `'flat'`, `'calculated'`, or `'free'` are normalized to `'free'`.
 * @param feeCentsPerUnit - Optional fee per unit (numeric). When the resulting mode is `'flat'`, this value is converted to integer cents and included in the snapshot.
 * @returns A ShippingSnapshot with `mode` set to `'flat'`, `'calculated'`, or `'free'`. When `mode` is `'flat'`, the snapshot includes `feeCentsPerUnit` expressed as integer cents.
 */
export function normalizeShippingSnapshot(
  mode: ShippingMode,
  feeCentsPerUnit?: number
): ShippingSnapshot {
  const m: ShippingMode =
    mode === 'flat' || mode === 'calculated' || mode === 'free' ? mode : 'free';
  const fee = m === 'flat' ? toIntCents(feeCentsPerUnit ?? 0) : undefined;
  return { mode: m, ...(fee !== undefined ? { feeCentsPerUnit: fee } : {}) };
}

const DEFAULT_TENANT = '__global__';

/**
 * Normalize a tenant slug by trimming whitespace, removing any "::..." suffix and its trailing content, and defaulting to DEFAULT_TENANT when empty.
 *
 * @param raw - Raw tenant slug which may include an optional "::..." suffix to denote user-scoped values
 * @returns The normalized tenant identifier; returns DEFAULT_TENANT when `raw` is empty or only whitespace
 */

export function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return DEFAULT_TENANT;
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(0, i) : s;
}

const DEVICE_ID_KEY = 'ah_device_id';
const ANON_KEY_PREFIX = 'anon:';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      (typeof crypto !== 'undefined' &&
        'randomUUID' in crypto &&
        crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function deriveUserKey(userId?: string | null): string {
  const id = (userId ?? '').trim();
  return id.length > 0 ? id : `${ANON_KEY_PREFIX}${getOrCreateDeviceId()}`;
}
