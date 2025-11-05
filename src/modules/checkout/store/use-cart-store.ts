import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_TENANT = '__global__';

/**
 * Normalize a tenant slug into a stable base tenant identifier.
 *
 * Trims whitespace, defaults to DEFAULT_TENANT when the input is empty or missing, and strips any `"::..."` suffix returning only the portion before the first `"::"`.
 *
 * @param raw - The raw tenant slug which may be empty, null, or contain a composite `"tenant::sub"` form
 * @returns The normalized tenant slug (base portion without any `"::"` suffix, or DEFAULT_TENANT when input is empty)
 */

function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return DEFAULT_TENANT;
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(0, i) : s;
}

const ANON_KEY_PREFIX = 'anon:';
const DEVICE_ID_KEY = 'ah_device_id';

/**
 * Returns a stable device identifier, creating and persisting one in localStorage when needed.
 *
 * Generates and stores a new identifier if none exists in localStorage; on server-side execution returns the string `'server'`.
 *
 * @returns The device identifier string (persisted to localStorage when newly created).
 */

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

/**
 * Produce a stable user key for scoping cart data.
 *
 * Uses the provided `userId` trimmed when it contains characters; otherwise returns an anonymous key prefixed with `anon:` and a persistent device identifier.
 *
 * @param userId - Optional user identifier; whitespace-only or empty values are treated as absent
 * @returns The derived user key: the trimmed `userId` if present, otherwise `anon:<deviceId>`
 */

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
  byUser: UserMap;
  currentUserKey: string;

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
  /** NEW: clear by `${tenant}::${userKey}` without switching current user */
  clearCartForScope: (scopeKey: string) => void;
  clearAllCartsForCurrentUser: () => void;
  clearAllCartsEverywhere: () => void;
  migrateAnonToUser: (tenantSlug: string, newUserId: string) => void;

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

/**
 * Merge composite tenant keys of the form "tenant::sub" into their base tenant per user,
 * combining product IDs and removing duplicates.
 *
 * @param byUser - Mapping from user key to that user's tenant map to normalize
 * @returns A new UserMap where tenant keys containing `::` are collapsed to their base tenant,
 * with each tenant's `productIds` array deduplicated; tenants with empty names are omitted
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
      const prev = merged[cleanTenant]?.productIds ?? [];
      const next = Array.from(
        new Set([...(prev ?? []), ...(cart?.productIds ?? [])])
      );
      merged[cleanTenant] = { productIds: next };
    }
    out[userKey] = merged;
  }
  return out;
}

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

        // NEW: clear a cart given `${tenant}::${userKey}`, without changing currentUserKey
        clearCartForScope: (scopeKey) => {
          const sep = scopeKey.indexOf('::');
          const tenantPart = sep > -1 ? scopeKey.slice(0, sep) : scopeKey;
          const userKey = sep > -1 ? scopeKey.slice(sep + 2) : '';

          const tenant = normalizeTenantSlug(tenantPart);
          if (!tenant || !userKey) return;

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
              dst[tenant] = {
                productIds: Array.from(new Set(dst[tenant]?.productIds ?? []))
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

          const srcIds = srcBucket[tenant]?.productIds ?? [];
          set((prev) => {
            const byUser = collapseCompositeTenantKeys(prev.byUser);
            const src = { ...(byUser[anonKey] || {}) };
            const dst = { ...(byUser[dstUserKey] || {}) };

            const merged = Array.from(
              new Set([...(dst[tenant]?.productIds ?? []), ...srcIds])
            );

            byUser[anonKey] = { ...src, [tenant]: { productIds: [] } };
            byUser[dstUserKey] = { ...dst, [tenant]: { productIds: merged } };

            return { byUser, currentUserKey: dstUserKey };
          });
        },

        __cleanupTenantKeys: undefined
      };
    },
    {
      name: 'abandonedHobbies-cart',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: unknown, fromVersion: number) => {
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

        if (fromVersion < 3 && persisted && typeof persisted === 'object') {
          const s = (persisted as { state?: { byUser?: UserMap } }).state;
          if (!s?.byUser) return persisted;
          return {
            state: { ...s, byUser: collapseCompositeTenantKeys(s.byUser) }
          };
        }

        if (fromVersion < 4 && persisted && typeof persisted === 'object') {
          const s = (persisted as { state?: { byUser?: UserMap } }).state;
          if (!s?.byUser) return persisted;
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
            const prev = merged[cleanTenant]?.productIds ?? [];
            const next = Array.from(
              new Set([...(prev ?? []), ...(cart?.productIds ?? [])])
            );
            merged[cleanTenant] = { productIds: next };
          }
          out[userKey] = merged;
        }
        return out;
      })(byUser);
      if (fixed !== byUser) useCartStore.setState({ byUser: fixed });
    }
  });
}
