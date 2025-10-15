import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ---------- constants / helpers ----------
const DEFAULT_TENANT = '__global__';

// We store carts by *tenant only*. If a composite sneaks in ("tenant::user"),
// strip the suffix to keep storage shape stable.
function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return DEFAULT_TENANT;
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(0, i) : s;
}

// ---------- user key helpers ----------
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

// ---------- types ----------
interface TenantCart {
  productIds: string[];
}
type TenantMap = Record<string, TenantCart>; // tenantSlug -> TenantCart
type UserMap = Record<string, TenantMap>; // userKey -> TenantMap

export interface CartState {
  byUser: UserMap; // userKey -> tenantSlug -> { productIds }
  currentUserKey: string; // active user namespace (anon:... or real user id)

  setCurrentUserKey: (userId?: string | null) => void;

  addProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  removeProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  clearCart: (tenantSlug: string | null | undefined) => void;
  clearAllCartsForCurrentUser: () => void;
  clearAllCartsEverywhere: () => void;
  migrateAnonToUser: (tenantSlug: string, newUserId: string) => void;

  // dev-only helper (exposed in non-prod)
  __cleanupTenantKeys?: () => void;
}

// ---------- optional cross-tab sync ----------
const CHANNEL_NAME = 'cart';
const bc: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

type CartMessage =
  | { type: 'CLEAR_CART'; userKey: string; tenantSlug: string }
  | { type: 'CLEAR_ALL_FOR_USER'; userKey: string }
  | { type: 'CLEAR_ALL_GLOBAL' };

// --- internal cleanup that merges composite tenant keys into plain tenant ---
function collapseCompositeTenantKeys(byUser: UserMap): UserMap {
  const out: UserMap = {};
  for (const userKey in byUser) {
    const tenantMap = byUser[userKey];
    const merged: TenantMap = {};
    for (const rawTenant in tenantMap) {
      const cart = tenantMap[rawTenant];
      const cleanTenant = rawTenant.includes('::')
        ? rawTenant.split('::')[0]
        : rawTenant;
      if (!cleanTenant) continue;
      const prev = merged[cleanTenant]?.productIds ?? [];
      const next = Array.from(
        new Set<string>([...prev, ...(cart?.productIds ?? [])])
      );
      merged[cleanTenant] = { productIds: next };
    }
    out[userKey] = merged;
  }
  return out;
}

// ---------- typed migration helpers (no any) ----------
type PersistedV1 = {
  state?: {
    tenantCarts?: Record<string, TenantCart>;
  };
};

type PersistedVx = {
  state?: {
    byUser?: UserMap;
    currentUserKey?: string;
  };
};

function isPersistedV1(value: unknown): value is PersistedV1 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!('state' in v)) return false;
  const s = v.state as Record<string, unknown> | undefined;
  if (!s) return false;
  if (!('tenantCarts' in s)) return false;
  const tc = s.tenantCarts;
  if (tc === undefined) return true;
  if (typeof tc !== 'object' || tc === null) return false;
  return true;
}

function isPersistedVx(value: unknown): value is PersistedVx {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!('state' in v)) return false;
  const s = v.state as Record<string, unknown> | undefined;
  if (!s) return false;
  // byUser optional, if present must be object
  if ('byUser' in s && (typeof s.byUser !== 'object' || s.byUser === null)) {
    return false;
  }
  return true;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      // initialize currentUserKey (guest by default)
      const initialUserKey = deriveUserKey(null);

      // broadcast listeners
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
            const next: UserMap = { ...byUser };
            delete next[msg.userKey];
            set({ byUser: next });
            return;
          }

          if (msg.type === 'CLEAR_CART') {
            const tenant = normalizeTenantSlug(msg.tenantSlug);
            const userBucket = byUser[msg.userKey];
            if (!userBucket?.[tenant]?.productIds?.length) return;

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

        setCurrentUserKey: (userId) => {
          const nextKey = deriveUserKey(userId);
          if (nextKey === get().currentUserKey) return;
          set({ currentUserKey: nextKey });
        },

        addProduct: (tenantSlug, productId) => {
          const tenant = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const current = userBucket[tenant]?.productIds ?? [];
            if (current.includes(productId)) return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: { productIds: [...current, productId] }
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
            const current = userBucket[tenant]?.productIds ?? [];
            if (!current.includes(productId)) return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    productIds: current.filter((id) => id !== productId)
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
            const current = userBucket[tenant]?.productIds ?? [];
            if (current.length === 0) return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: { productIds: [] }
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
            const next: UserMap = { ...state.byUser };
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

          // Only migrate if we're currently anon
          if (!isAnonKey(anonKey)) {
            // still make sure our tenant key is normalized for the authed user
            const tenant = normalizeTenantSlug(tenantSlug);
            set((prev) => {
              const byUser: UserMap = { ...prev.byUser };
              const dst: TenantMap = { ...(byUser[newUserId] || {}) };
              const existing = dst[tenant]?.productIds ?? [];
              dst[tenant] = { productIds: Array.from(new Set(existing)) };
              byUser[newUserId] = dst;
              return { byUser, currentUserKey: newUserId };
            });
            return;
          }

          const tenant = normalizeTenantSlug(tenantSlug);
          const srcBucket = state.byUser[anonKey] || {};
          const dstUserKey = newUserId.trim();
          if (!dstUserKey) {
            // keep silent in strict mode; caller passed empty id
            return;
          }

          const srcIds = srcBucket[tenant]?.productIds ?? [];
          set((prev) => {
            const sanitized = collapseCompositeTenantKeys(prev.byUser);
            const byUser: UserMap = { ...sanitized };
            const src: TenantMap = { ...(byUser[anonKey] || {}) };
            const dst: TenantMap = { ...(byUser[dstUserKey] || {}) };

            const merged = Array.from(
              new Set<string>([...(dst[tenant]?.productIds ?? []), ...srcIds])
            );

            byUser[anonKey] = { ...src, [tenant]: { productIds: [] } };
            byUser[dstUserKey] = { ...dst, [tenant]: { productIds: merged } };

            return { byUser, currentUserKey: dstUserKey };
          });
        },

        // dev helper (wired below in non-prod)
        __cleanupTenantKeys: undefined
      };
    },
    {
      name: 'abandonedHobbies-cart',
      version: 4, // ← v4 forcibly collapses any 'tenant::whatever' keys
      storage: createJSONStorage((): Storage => localStorage),
      migrate: (persisted: unknown, fromVersion: number): unknown => {
        // v1→v2 (legacy: {tenantCarts} → byUser[currentUserKey])
        if (fromVersion < 2 && isPersistedV1(persisted)) {
          const tenantCarts = persisted.state?.tenantCarts;
          const currentUserKey = deriveUserKey(null);
          const byUser: UserMap =
            tenantCarts !== undefined ? { [currentUserKey]: tenantCarts } : {};
          return { state: { byUser, currentUserKey } };
        }

        // v2→v3 or v3→v4: collapse composite keys (idempotent)
        if (fromVersion < 4 && isPersistedVx(persisted)) {
          const s = persisted.state;
          if (!s?.byUser) return persisted;
          return {
            state: { ...s, byUser: collapseCompositeTenantKeys(s.byUser) }
          };
        }

        return persisted;
      },
      // Extra safety: after hydration, sanitize once more in-memory
      onRehydrateStorage:
        () =>
        (rehydratedState?: CartState): void => {
          if (!rehydratedState) return;
          const fixed = collapseCompositeTenantKeys(rehydratedState.byUser);
          // shallow compare object references by serializing keys per user (cheap)
          const sameRef = fixed === rehydratedState.byUser;
          if (!sameRef) {
            useCartStore.setState({ byUser: fixed });
          }
        }
    }
  )
);

// Dev helper: expose the store + a manual cleanup trigger
declare global {
  interface Window {
    ahCartStore?: typeof useCartStore;
  }
}

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  window.ahCartStore = useCartStore;
  useCartStore.setState({
    __cleanupTenantKeys: () => {
      const { byUser } = useCartStore.getState();
      const fixed = collapseCompositeTenantKeys(byUser);
      if (fixed !== byUser) useCartStore.setState({ byUser: fixed });
    }
  });
}
