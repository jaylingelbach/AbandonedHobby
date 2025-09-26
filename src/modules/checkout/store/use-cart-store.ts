import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Single place to normalize tenant scope */
const DEFAULT_SCOPE = '__global__';
function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  return s.length > 0 ? s : DEFAULT_SCOPE;
}

interface TenantCart {
  productIds: string[];
}

interface CartState {
  tenantCarts: Record<string, TenantCart>;
  addProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  removeProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  clearCart: (tenantSlug: string | null | undefined) => void;
  clearAllCarts: () => void;
}

/** Optional cross-tab broadcast (persist already listens to storage events) */
const CHANNEL_NAME = 'cart';
const bc: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

type CartMessage =
  | { type: 'CLEAR_CART'; tenantSlug: string }
  | { type: 'CLEAR_ALL' };

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      // Listen for broadcasts from other tabs
      if (bc) {
        bc.onmessage = (evt: MessageEvent<CartMessage>) => {
          const msg = evt.data;
          if (!msg) return;
          if (msg.type === 'CLEAR_ALL') {
            set({ tenantCarts: {} });
          } else if (msg.type === 'CLEAR_CART') {
            const scope = normalizeTenantSlug(msg.tenantSlug);
            const { tenantCarts } = get();
            if (!tenantCarts[scope]?.productIds?.length) return; // idempotent
            set({
              tenantCarts: {
                ...tenantCarts,
                [scope]: { productIds: [] }
              }
            });
          }
        };
      }

      return {
        tenantCarts: {},

        addProduct: (tenantSlug, productId) => {
          const scope = normalizeTenantSlug(tenantSlug);
          set((state) => {
            const current = state.tenantCarts[scope]?.productIds ?? [];
            // Avoid duplicates
            if (current.includes(productId)) return state;
            return {
              tenantCarts: {
                ...state.tenantCarts,
                [scope]: { productIds: [...current, productId] }
              }
            };
          });
        },

        removeProduct: (tenantSlug, productId) => {
          const scope = normalizeTenantSlug(tenantSlug);
          set((state) => {
            const current = state.tenantCarts[scope]?.productIds ?? [];
            if (!current.includes(productId)) return state; // idempotent
            return {
              tenantCarts: {
                ...state.tenantCarts,
                [scope]: {
                  productIds: current.filter((id) => id !== productId)
                }
              }
            };
          });
        },

        clearCart: (tenantSlug) => {
          const scope = normalizeTenantSlug(tenantSlug);
          set((state) => {
            const current = state.tenantCarts[scope]?.productIds ?? [];
            if (current.length === 0) return state; // idempotent
            const next = {
              ...state.tenantCarts,
              [scope]: { productIds: [] }
            };
            return { tenantCarts: next };
          });
          // tell other tabs
          bc?.postMessage({ type: 'CLEAR_CART', tenantSlug: scope });
        },

        clearAllCarts: () => {
          // idempotent by design
          set({ tenantCarts: {} });
          // tell other tabs
          bc?.postMessage({ type: 'CLEAR_ALL' });
        }
      };
    },
    {
      name: 'abandonedHobbies-cart',
      storage: createJSONStorage(() => localStorage)
      // persist already syncs across tabs via the 'storage' event;
      // BroadcastChannel just makes CLEAR actions immediate.
    }
  )
);
