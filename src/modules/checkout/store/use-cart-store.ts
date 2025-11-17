import { ShippingMode } from '@/modules/orders/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toIntCents } from '@/lib/money';
import {
  readQuantityOrDefault,
  type Quantity
} from '@/lib/validation/quantity';

const DEFAULT_TENANT = '__global__';

function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return DEFAULT_TENANT;
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(0, i) : s;
}

const ANON_KEY_PREFIX = 'anon:';
const DEVICE_ID_KEY = 'ah_device_id';

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

function deriveUserKey(userId?: string | null): string {
  const id = (userId ?? '').trim();
  return id.length > 0 ? id : `${ANON_KEY_PREFIX}${getOrCreateDeviceId()}`;
}

const isAnonKey = (k: string) => k.startsWith(ANON_KEY_PREFIX);

/** ── Types ─────────────────────────────────────────────────────────────── */
type ShippingSnapshot = {
  mode: ShippingMode; // 'free' | 'flat' | 'calculated'
  /** Only used when mode === 'flat'. Stored as integer cents per unit. */
  feeCentsPerUnit?: number;
};

interface TenantCart {
  productIds: string[];
  /** Per-product quantity (units), validated as Quantity. */
  quantitiesByProductId?: Record<string, Quantity>;
  /** Per-product shipping snapshot captured at add-to-cart time. */
  shippingByProductId?: Record<string, ShippingSnapshot>;
}
type TenantMap = Record<string, TenantCart>; // tenantSlug -> TenantCart
type UserMap = Record<string, TenantMap>; // userKey -> TenantMap

export interface CartState {
  byUser: UserMap;
  currentUserKey: string;

  /** Capture or update a product's shipping snapshot for a tenant. */
  setProductShippingSnapshot: (
    tenantSlug: string | null | undefined,
    productId: string,
    mode: ShippingMode,
    feeCentsPerUnit?: number
  ) => void;

  setCurrentUserKey: (userId?: string | null) => void;

  addProduct: (
    tenantSlug: string | null | undefined,
    productId: string,
    quantity?: number
  ) => void;
  removeProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  clearCart: (tenantSlug: string | null | undefined) => void;
  /** clear by `${tenant}::${userKey}` without switching current user */
  clearCartForScope: (scopeKey: string) => void;
  clearAllCartsForCurrentUser: () => void;
  clearAllCartsEverywhere: () => void;
  migrateAnonToUser: (tenantSlug: string, newUserId: string) => void;

  __cleanupTenantKeys?: () => void;
}

/** ── Cross-tab sync ───────────────────────────────────────────────────── */
const CHANNEL_NAME = 'cart';
const bc: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

type CartMessage =
  | { type: 'CLEAR_CART'; userKey: string; tenantSlug: string }
  | { type: 'CLEAR_ALL_FOR_USER'; userKey: string }
  | { type: 'CLEAR_ALL_GLOBAL' };

/** ── Helpers ───────────────────────────────────────────────────────────── */

/**
 * Merge composite tenant keys "tenant::sub" into base tenant per user.
 * Also merges `shippingByProductId` maps; later entries win on key conflicts.
 */
function collapseCompositeTenantKeys(byUser: UserMap): UserMap {
  const out: UserMap = {};
  for (const [userKey, tenantMap] of Object.entries(byUser || {})) {
    const merged: TenantMap = {};
    for (const [rawTenant, cart] of Object.entries(tenantMap || {})) {
      const cleanTenant = rawTenant.includes('::')
        ? rawTenant.split('::')[0]
        : rawTenant;
      if (!cleanTenant) continue;

      const prevIds = merged[cleanTenant]?.productIds ?? [];
      const nextIds = Array.from(
        new Set([...(prevIds ?? []), ...(cart?.productIds ?? [])])
      );

      const prevShip = merged[cleanTenant]?.shippingByProductId ?? {};
      const nextShip = { ...prevShip, ...(cart?.shippingByProductId ?? {}) };

      merged[cleanTenant] = {
        productIds: nextIds,
        ...(Object.keys(nextShip).length > 0
          ? { shippingByProductId: nextShip }
          : {})
      };
    }
    out[userKey] = merged;
  }
  return out;
}

/** Normalize and clamp a snapshot. */
function normalizeShippingSnapshot(
  mode: ShippingMode,
  feeCentsPerUnit?: number
): ShippingSnapshot {
  const m: ShippingMode =
    mode === 'flat' || mode === 'calculated' || mode === 'free' ? mode : 'free';
  const fee = m === 'flat' ? toIntCents(feeCentsPerUnit ?? 0) : undefined;
  return { mode: m, ...(fee !== undefined ? { feeCentsPerUnit: fee } : {}) };
}

/** ── Store ─────────────────────────────────────────────────────────────── */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      const initialUserKey = deriveUserKey(null);

      if (bc) {
        bc.onmessage = (evt: MessageEvent<CartMessage>) => {
          const msg = evt.data;
          if (!msg) return;

          const { byUser } = get();

          if (msg.type === 'CLEAR_ALL_GLOBAL') {
            set({ byUser: {} });
            return;
          }

          if (msg.type === 'CLEAR_ALL_FOR_USER') {
            if (!byUser[msg.userKey]) return;
            const next = { ...byUser };
            delete next[msg.userKey];
            set({ byUser: next });
            return;
          }

          if (msg.type === 'CLEAR_CART') {
            const tenant = normalizeTenantSlug(msg.tenantSlug);
            const userBucket = byUser[msg.userKey];
            const existing = userBucket?.[tenant];
            if (!existing?.productIds?.length && !existing?.shippingByProductId)
              return;

            set({
              byUser: {
                ...byUser,
                [msg.userKey]: {
                  ...userBucket,
                  [tenant]: { productIds: [] }
                }
              }
            });
            return;
          }
        };
      }

      return {
        byUser: {},
        currentUserKey: initialUserKey,

        setProductShippingSnapshot: (tenantSlug, productId, mode, fee) => {
          const tenant = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;
          const snap = normalizeShippingSnapshot(mode, fee);

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const tenantCart: TenantCart = userBucket[tenant] ?? {
              productIds: []
            };
            const shipMap = { ...(tenantCart.shippingByProductId ?? {}) };

            shipMap[productId] = snap;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    ...tenantCart,
                    shippingByProductId: shipMap
                  }
                }
              }
            };
          });
        },

        setCurrentUserKey: (userId) => {
          const nextKey = deriveUserKey(userId);
          if (nextKey === get().currentUserKey) return;
          set({ currentUserKey: nextKey });
        },

        addProduct: (tenantSlug, productId, quantity) => {
          const tenant = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const tenantCart: TenantCart = userBucket[tenant] ?? {
              productIds: []
            };

            const currentIds = tenantCart.productIds ?? [];
            const alreadyInCart = currentIds.includes(productId);

            const effectiveQuantity = readQuantityOrDefault(quantity, 1);

            const nextIds = alreadyInCart
              ? currentIds
              : [...currentIds, productId];

            const currentQuantities = tenantCart.quantitiesByProductId ?? {};
            const nextQuantities: Record<string, Quantity> = {
              ...currentQuantities,
              [productId]: effectiveQuantity
            };

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    ...tenantCart,
                    productIds: nextIds,
                    quantitiesByProductId: nextQuantities
                  }
                }
              }
            };
          });
        },

        removeProduct: (tenantSlug, productId) => {
          const tenant = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const tenantCart: TenantCart = userBucket[tenant] ?? {
              productIds: []
            };

            const currentIds = tenantCart.productIds ?? [];
            if (!currentIds.includes(productId)) return state;

            const nextIds = currentIds.filter((id) => id !== productId);

            const nextShip = { ...(tenantCart.shippingByProductId ?? {}) };
            if (productId in nextShip) delete nextShip[productId];

            const nextQuantities = {
              ...(tenantCart.quantitiesByProductId ?? {})
            };
            if (productId in nextQuantities) delete nextQuantities[productId];

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    productIds: nextIds,
                    ...(Object.keys(nextShip).length > 0
                      ? { shippingByProductId: nextShip }
                      : {}),
                    ...(Object.keys(nextQuantities).length > 0
                      ? { quantitiesByProductId: nextQuantities }
                      : {})
                  }
                }
              }
            };
          });
        },

        clearCart: (tenantSlug) => {
          const tenant = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const existing = userBucket[tenant];
            if (!existing?.productIds?.length && !existing?.shippingByProductId)
              return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: { productIds: [], shippingByProductId: {} }
                }
              }
            };
          });

          bc?.postMessage({ type: 'CLEAR_CART', userKey, tenantSlug: tenant });
        },

        clearCartForScope: (scopeKey) => {
          const sep = scopeKey.indexOf('::');
          const tenantPart = sep > -1 ? scopeKey.slice(0, sep) : scopeKey;
          const userKey = sep > -1 ? scopeKey.slice(sep + 2) : '';

          const tenant = normalizeTenantSlug(tenantPart);
          if (!tenant || !userKey) return;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const existing = userBucket[tenant];
            if (!existing?.productIds?.length && !existing?.shippingByProductId)
              return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: { productIds: [], shippingByProductId: {} }
                }
              }
            };
          });

          bc?.postMessage({ type: 'CLEAR_CART', userKey, tenantSlug: tenant });
        },

        clearAllCartsForCurrentUser: () => {
          const userKey = get().currentUserKey;
          set((state) => {
            if (!state.byUser[userKey]) return state;
            const next = { ...state.byUser };
            delete next[userKey];
            return { byUser: next };
          });
          bc?.postMessage({ type: 'CLEAR_ALL_FOR_USER', userKey });
        },

        clearAllCartsEverywhere: () => {
          set({ byUser: {} });
          bc?.postMessage({ type: 'CLEAR_ALL_GLOBAL' });
        },

        migrateAnonToUser: (tenantSlug, newUserId) => {
          const state = get();
          const anonKey = state.currentUserKey;

          if (!isAnonKey(anonKey)) {
            const tenant = normalizeTenantSlug(tenantSlug);
            set((prev) => {
              const byUser = { ...prev.byUser };
              const dst = { ...(byUser[newUserId] || {}) };
              const prevCart = dst[tenant] ?? { productIds: [] };
              dst[tenant] = {
                productIds: Array.from(new Set(prevCart.productIds ?? [])),
                ...(prevCart.shippingByProductId
                  ? { shippingByProductId: { ...prevCart.shippingByProductId } }
                  : {})
              };
              byUser[newUserId] = dst;
              return { byUser, currentUserKey: newUserId };
            });
            return;
          }

          const tenant = normalizeTenantSlug(tenantSlug);
          const srcBucket = state.byUser[anonKey] || {};
          const dstUserKey = newUserId.trim();
          if (!dstUserKey) return;

          const srcCart: TenantCart = srcBucket[tenant] ?? { productIds: [] };
          const srcIds = srcCart.productIds ?? [];
          const srcShip = srcCart.shippingByProductId ?? {};

          set((prev) => {
            const byUser = collapseCompositeTenantKeys(prev.byUser);
            const src = { ...(byUser[anonKey] || {}) };
            const dst = { ...(byUser[dstUserKey] || {}) };

            const dstCart: TenantCart = dst[tenant] ?? { productIds: [] };
            const mergedIds = Array.from(
              new Set([...(dstCart.productIds ?? []), ...srcIds])
            );
            const mergedShip = {
              ...(dstCart.shippingByProductId ?? {}),
              ...srcShip
            };

            byUser[anonKey] = {
              ...src,
              [tenant]: { productIds: [], shippingByProductId: {} }
            };
            byUser[dstUserKey] = {
              ...dst,
              [tenant]: {
                productIds: mergedIds,
                ...(Object.keys(mergedShip).length > 0
                  ? { shippingByProductId: mergedShip }
                  : {})
              }
            };

            return { byUser, currentUserKey: dstUserKey };
          });
        },

        __cleanupTenantKeys: undefined
      };
    },
    {
      name: 'abandonedHobbies-cart',
      /** bump: add shipping snapshots (v5) */
      version: 5,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: unknown, fromVersion: number) => {
        // v1 -> v2 : initial user-key migration
        if (fromVersion < 2 && persisted && typeof persisted === 'object') {
          const maybeState = persisted as Record<string, unknown>;
          const legacy = maybeState['state'] as
            | Record<string, unknown>
            | undefined;
          const tenantCarts = (legacy?.['tenantCarts'] ?? null) as Record<
            string,
            TenantCart
          > | null;

          const currentUserKey = deriveUserKey(null);
          const byUser: UserMap = tenantCarts
            ? { [currentUserKey]: tenantCarts }
            : {};

          return { state: { byUser, currentUserKey } };
        }

        // v2 -> v3 : collapse composite tenant keys
        if (fromVersion < 3 && persisted && typeof persisted === 'object') {
          const s = (persisted as { state?: { byUser?: UserMap } }).state;
          if (!s?.byUser) return persisted;
          return {
            state: { ...s, byUser: collapseCompositeTenantKeys(s.byUser) }
          };
        }

        // v3 -> v4 : re-collapse (safety)
        if (fromVersion < 4 && persisted && typeof persisted === 'object') {
          const s = (persisted as { state?: { byUser?: UserMap } }).state;
          if (!s?.byUser) return persisted;
          return {
            state: { ...s, byUser: collapseCompositeTenantKeys(s.byUser) }
          };
        }

        // v4 -> v5 : add shipping map if missing (no destructive changes)
        if (fromVersion < 5 && persisted && typeof persisted === 'object') {
          const s = (persisted as { state?: { byUser?: UserMap } }).state;
          if (!s?.byUser) return persisted;

          // No explicit rewrite necessary; runtime code reads missing maps as {}.
          // Still normalize tenant keys to be safe.
          return {
            state: { ...s, byUser: collapseCompositeTenantKeys(s.byUser) }
          };
        }

        return persisted as unknown;
      },
      onRehydrateStorage: () => (rehydratedState) => {
        if (!rehydratedState) return;
        try {
          const fixed = collapseCompositeTenantKeys(rehydratedState.byUser);
          if (fixed !== rehydratedState.byUser) {
            useCartStore.setState({ byUser: fixed });
          }
        } catch {
          // no-op
        }
      }
    }
  )
);

// Dev helper
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  // @ts-expect-error – dev only
  window.ahCartStore = useCartStore;
  useCartStore.setState({
    __cleanupTenantKeys: () => {
      const { byUser } = useCartStore.getState();
      const fixed = (function collapse(byUserIn: UserMap): UserMap {
        const out: UserMap = {};
        for (const [userKey, tenantMap] of Object.entries(byUserIn || {})) {
          const merged: TenantMap = {};
          for (const [rawTenant, cart] of Object.entries(tenantMap || {})) {
            const cleanTenant = rawTenant.includes('::')
              ? rawTenant.split('::')[0]
              : rawTenant;
            if (!cleanTenant) continue;
            const prevIds = merged[cleanTenant]?.productIds ?? [];
            const nextIds = Array.from(
              new Set([...(prevIds ?? []), ...(cart?.productIds ?? [])])
            );
            const prevShip = merged[cleanTenant]?.shippingByProductId ?? {};
            const nextShip = {
              ...prevShip,
              ...(cart?.shippingByProductId ?? {})
            };
            merged[cleanTenant] = {
              productIds: nextIds,
              ...(Object.keys(nextShip).length > 0
                ? { shippingByProductId: nextShip }
                : {})
            };
          }
          out[userKey] = merged;
        }
        return out;
      })(byUser);
      if (fixed !== byUser) useCartStore.setState({ byUser: fixed });
    }
  });
}
