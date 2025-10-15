// /store/use-cart-store.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_SCOPE = '__global__';
function normalizeTenantSlug(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SCOPE;
}

// ---------- user key helpers ----------
const ANON_KEY_PREFIX = 'anon:';
const DEVICE_ID_KEY = 'ah_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = crypto?.randomUUID?.() ?? String(Date.now());
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

function deriveUserKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0) return userId.trim();
  return `${ANON_KEY_PREFIX}${getOrCreateDeviceId()}`;
}

// ---------- types ----------
interface TenantCart {
  productIds: string[];
}

type TenantMap = Record<string, TenantCart>;
type UserMap = Record<string, TenantMap>;

interface CartState {
  byUser: UserMap; // userKey -> tenantSlug -> TenantCart
  currentUserKey: string; // active user namespace

  setCurrentUserKey: (userId?: string | null) => void;

  addProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  removeProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  clearCart: (tenantSlug: string | null | undefined) => void; // current user only
  clearAllCartsForCurrentUser: () => void; // current user only
  clearAllCartsEverywhere: () => void; // admin/dev helper
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
            const next = { ...byUser };
            delete next[msg.userKey];
            set({ byUser: next });
            return;
          }

          if (msg.type === 'CLEAR_CART') {
            const scope = normalizeTenantSlug(msg.tenantSlug);
            const userBucket = byUser[msg.userKey];
            if (!userBucket?.[scope]?.productIds?.length) return;

            set({
              byUser: {
                ...byUser,
                [msg.userKey]: {
                  ...userBucket,
                  [scope]: { productIds: [] }
                }
              }
            });
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
          const scope = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const current = userBucket[scope]?.productIds ?? [];
            if (current.includes(productId)) return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [scope]: { productIds: [...current, productId] }
                }
              }
            };
          });
        },

        removeProduct: (tenantSlug, productId) => {
          const scope = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const current = userBucket[scope]?.productIds ?? [];
            if (!current.includes(productId)) return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [scope]: {
                    productIds: current.filter((id) => id !== productId)
                  }
                }
              }
            };
          });
        },

        clearCart: (tenantSlug) => {
          const scope = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const current = userBucket[scope]?.productIds ?? [];
            if (current.length === 0) return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [scope]: { productIds: [] }
                }
              }
            };
          });

          bc?.postMessage({ type: 'CLEAR_CART', userKey, tenantSlug: scope });
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

        // Optional: only use in admin/debug tools
        clearAllCartsEverywhere: () => {
          set({ byUser: {} });
          bc?.postMessage({ type: 'CLEAR_ALL_GLOBAL' });
        }
      };
    },
    {
      name: 'abandonedHobbies-cart', // keep the same key
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // migrate old { tenantCarts } shape into byUser[currentUserKey]
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

          return {
            state: {
              byUser,
              currentUserKey
            }
          };
        }
        return persisted as unknown;
      }
    }
  )
);
