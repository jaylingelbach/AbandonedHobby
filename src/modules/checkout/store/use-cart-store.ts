import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Quantity } from '@/lib/validation/quantity';
import { CartMessage, CartState, TenantCart, UserMap } from './types';
import {
  collapseCompositeTenantKeys,
  deriveUserKey,
  normalizeShippingSnapshot,
  normalizeTenantSlug
} from './utils';

const ANON_KEY_PREFIX = 'anon:';

const isAnonKey = (k: string) => k.startsWith(ANON_KEY_PREFIX);

/** ── Cross-tab sync ───────────────────────────────────────────────────── */
const CHANNEL_NAME = 'cart';
const bc: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

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

            const hasNoProductIds =
              !existing?.productIds || existing.productIds.length === 0;

            const hasNoShipping =
              !existing?.shippingByProductId ||
              Object.keys(existing.shippingByProductId).length === 0;

            const hasNoQuantities =
              !existing?.quantitiesByProductId ||
              Object.keys(existing.quantitiesByProductId).length === 0;

            // Nothing meaningful to clear for this tenant/user
            if (hasNoProductIds && hasNoShipping && hasNoQuantities) {
              return;
            }

            set({
              byUser: {
                ...byUser,
                [msg.userKey]: {
                  ...userBucket,
                  [tenant]: {
                    productIds: [],
                    shippingByProductId: {},
                    quantitiesByProductId: {}
                  }
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

          if (process.env.NODE_ENV !== 'production') {
            console.log('[cart:addProduct]', {
              userKey,
              tenant,
              productId,
              quantity
            });
          }

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const existingCart: TenantCart = userBucket[tenant] ?? {
              productIds: []
            };

            const currentIds = existingCart.productIds ?? [];
            const nextIds = currentIds.includes(productId)
              ? currentIds
              : [...currentIds, productId];

            const currentQuantities: Record<string, Quantity> =
              existingCart.quantitiesByProductId ?? {};
            const existingQty = currentQuantities[productId];

            const normalizedQuantity: Quantity =
              typeof quantity === 'number' &&
              Number.isFinite(quantity) &&
              quantity > 0 &&
              Number.isInteger(quantity)
                ? quantity
                : typeof existingQty === 'number' &&
                    Number.isFinite(existingQty) &&
                    existingQty > 0 &&
                    Number.isInteger(existingQty)
                  ? existingQty
                  : 1;

            const nextQuantities: Record<string, Quantity> = {
              ...currentQuantities,
              [productId]: normalizedQuantity
            };

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    ...existingCart,
                    productIds: nextIds,
                    ...(Object.keys(nextQuantities).length > 0
                      ? { quantitiesByProductId: nextQuantities }
                      : {})
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
            const current = tenantCart.productIds ?? [];
            if (!current.includes(productId)) return state;

            const nextShip = { ...(tenantCart.shippingByProductId ?? {}) };
            if (productId in nextShip) delete nextShip[productId];

            const nextQty = { ...(tenantCart.quantitiesByProductId ?? {}) };
            if (productId in nextQty) delete nextQty[productId];

            const nextCart: TenantCart = {
              productIds: current.filter((id) => id !== productId),
              ...(Object.keys(nextShip).length > 0
                ? { shippingByProductId: nextShip }
                : {}),
              ...(Object.keys(nextQty).length > 0
                ? { quantitiesByProductId: nextQty }
                : {})
            };

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: nextCart
                }
              }
            };
          });
        },

        clearCart: (tenantSlug) => {
          const tenant = normalizeTenantSlug(tenantSlug);
          const userKey = get().currentUserKey;

          if (process.env.NODE_ENV !== 'production') {
            console.log('[cart:clearCart]', { userKey, tenant });
          }

          set((state) => {
            const userBucket = state.byUser[userKey] ?? {};
            const existing = userBucket[tenant];
            if (
              !existing?.productIds?.length &&
              !existing?.shippingByProductId &&
              !existing?.quantitiesByProductId
            )
              return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    productIds: [],
                    shippingByProductId: {},
                    quantitiesByProductId: {}
                  }
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
            if (
              !existing?.productIds?.length &&
              !existing?.shippingByProductId &&
              !existing?.quantitiesByProductId
            )
              return state;

            return {
              byUser: {
                ...state.byUser,
                [userKey]: {
                  ...userBucket,
                  [tenant]: {
                    productIds: [],
                    shippingByProductId: {},
                    quantitiesByProductId: {}
                  }
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

        removeMissingProductsForCurrentUser: (missingProductIds) => {
          if (missingProductIds.length === 0) return;

          const { currentUserKey, byUser } = get();
          if (!currentUserKey) return;

          const userCarts = byUser[currentUserKey];
          if (!userCarts) return;

          const updatedUserCarts: Record<string, TenantCart> = {};

          for (const [tenantKey, cart] of Object.entries(userCarts)) {
            const remainingProductIds = cart.productIds.filter(
              (id) => !missingProductIds.includes(id)
            );

            // If nothing changed, keep cart as-is
            if (remainingProductIds.length === cart.productIds.length) {
              updatedUserCarts[tenantKey] = cart;
              continue;
            }

            // Filter out missing products from shipping + quantities
            const updatedShippingByProductId: TenantCart['shippingByProductId'] =
              {};
            for (const [productId, value] of Object.entries(
              cart.shippingByProductId ?? {}
            )) {
              if (!missingProductIds.includes(productId)) {
                updatedShippingByProductId[productId] = value;
              }
            }

            const updatedQuantitiesByProductId: TenantCart['quantitiesByProductId'] =
              {};
            for (const [productId, value] of Object.entries(
              cart.quantitiesByProductId ?? {}
            )) {
              if (!missingProductIds.includes(productId)) {
                updatedQuantitiesByProductId[productId] = value;
              }
            }

            // If there are still items left for this tenant, keep the cart
            if (remainingProductIds.length > 0) {
              updatedUserCarts[tenantKey] = {
                productIds: remainingProductIds,
                ...(Object.keys(updatedShippingByProductId).length > 0
                  ? { shippingByProductId: updatedShippingByProductId }
                  : {}),
                ...(Object.keys(updatedQuantitiesByProductId).length > 0
                  ? { quantitiesByProductId: updatedQuantitiesByProductId }
                  : {})
              };
            }
            // else: drop this tenant’s cart entirely for this user
          }

          set({
            byUser: {
              ...byUser,
              [currentUserKey]: updatedUserCarts
            }
          });
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
                  : {}),
                ...(prevCart.quantitiesByProductId
                  ? {
                      quantitiesByProductId: {
                        ...prevCart.quantitiesByProductId
                      }
                    }
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
          const srcQty = srcCart.quantitiesByProductId ?? {};

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
            const mergedQty = {
              ...(dstCart.quantitiesByProductId ?? {}),
              ...srcQty
            };

            byUser[anonKey] = {
              ...src,
              [tenant]: {
                productIds: [],
                shippingByProductId: {},
                quantitiesByProductId: {}
              }
            };
            byUser[dstUserKey] = {
              ...dst,
              [tenant]: {
                productIds: mergedIds,
                ...(Object.keys(mergedShip).length > 0
                  ? { shippingByProductId: mergedShip }
                  : {}),
                ...(Object.keys(mergedQty).length > 0
                  ? { quantitiesByProductId: mergedQty }
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
      /** v5: add shipping snapshots + optional quantitiesByProductId */
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
      const fixed = collapseCompositeTenantKeys(byUser);
      if (fixed !== byUser) {
        useCartStore.setState({ byUser: fixed });
      }
    }
  });
}
