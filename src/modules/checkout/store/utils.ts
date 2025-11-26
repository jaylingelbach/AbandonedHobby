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

/** Normalize and clamp a snapshot. */
export function normalizeShippingSnapshot(
  mode: ShippingMode,
  feeCentsPerUnit?: number
): ShippingSnapshot {
  const m: ShippingMode =
    mode === 'flat' || mode === 'calculated' || mode === 'free' ? mode : 'free';
  const fee = m === 'flat' ? toIntCents(feeCentsPerUnit ?? 0) : undefined;
  return { mode: m, ...(fee !== undefined ? { feeCentsPerUnit: fee } : {}) };
}
