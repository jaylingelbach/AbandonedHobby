'use client';

import { useCallback, useMemo } from 'react';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';
import type { CartState, TenantCartSlice } from '../store/types';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

const DEFAULT_TENANT = '__global__';

// Keep storage shape stable: strip any accidental "::user" suffix
/**
 * Normalize a tenant slug by trimming whitespace, removing any "::..." suffix and its trailing content, and defaulting to DEFAULT_TENANT when empty.
 *
 * @param raw - Raw tenant slug which may include an optional "::..." suffix to denote user-scoped values
 * @returns The normalized tenant identifier; returns DEFAULT_TENANT when `raw` is empty or only whitespace
 */
function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return DEFAULT_TENANT;
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(0, i) : s;
}

/**
 * Provides tenant-scoped cart state and actions for a specific tenant.
 *
 * The hook normalizes the provided tenant slug and returns the cart's product IDs,
 * derived totals, and stable action wrappers bound to that tenant.
 *
 * @param tenantSlug - Tenant identifier; will be normalized (trimmed, empty -> DEFAULT_TENANT, and any `::...` suffix removed)
 * @param _userId - Accepted for convenience but ignored; the store is scoped by tenant only
 * @returns An object containing:
 *  - `productIds`: array of product IDs in the tenant's cart,
 *  - `totalItems`: total units across all products (respecting quantities),
 *  - `addProduct(productId, quantity?)`: adds/sets quantity for a product,
 *  - `removeProduct(productId)`: removes a product from this tenant's cart,
 *  - `clearCart()`: clears this tenant's cart,
 *  - `clearAllCartsForCurrentUser()`: clears all carts for the current user,
 *  - `toggleProduct(productId, quantity?)`: adds with quantity or removes,
 *  - `isProductInCart(productId)`: returns `true` if the product is in the cart, `false` otherwise
 */

const EMPTY_PRODUCT_IDS: string[] = [];
const EMPTY_QUANTITIES: Record<string, number> = {};

const EMPTY_SLICE: TenantCartSlice = {
  productIds: EMPTY_PRODUCT_IDS,
  quantitiesByProductId: EMPTY_QUANTITIES
};

const quantityCache = new WeakMap<
  Record<string, unknown>,
  Record<string, number>
>();

function sanitizeQuantities(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return EMPTY_QUANTITIES;

  const map = raw as Record<string, unknown>;
  const cached = quantityCache.get(map);
  if (cached) return cached;

  const entries = Object.entries(map);
  if (entries.length === 0) {
    quantityCache.set(map, EMPTY_QUANTITIES);
    return EMPTY_QUANTITIES;
  }

  let needsClone = false;
  for (const [, value] of entries) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isInteger(value)
    ) {
      needsClone = true;
      break;
    }
  }

  if (!needsClone) {
    const typed = map as Record<string, number>;
    quantityCache.set(map, typed);
    return typed;
  }

  const safe: Record<string, number> = {};
  let hasEntries = false;
  for (const [key, value] of entries) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isInteger(value)
    ) {
      continue;
    }

    hasEntries = true;
    safe[key] = value;
  }

  const normalized = hasEntries ? safe : EMPTY_QUANTITIES;
  quantityCache.set(map, normalized);
  return normalized;
}

export function useCart(tenantSlug?: string | null, _userId?: string | null) {
  void _userId;

  const tenant = useMemo(() => normalizeTenantSlug(tenantSlug), [tenantSlug]);

  const selectTenantSliceBase = useCallback(
    (state: CartState): TenantCartSlice => {
      const bucket = state.byUser[state.currentUserKey]?.[tenant];
      if (!bucket) return EMPTY_SLICE;

      const rawIds = Array.isArray(bucket.productIds)
        ? bucket.productIds
        : EMPTY_PRODUCT_IDS;

      const safeQuantities = sanitizeQuantities(bucket.quantitiesByProductId);

      if (rawIds.length === 0 && safeQuantities === EMPTY_QUANTITIES) {
        return EMPTY_SLICE;
      }

      return {
        productIds: rawIds,
        quantitiesByProductId: safeQuantities
      };
    },
    [tenant]
  );

  const selectTenantSlice = useShallow(selectTenantSliceBase);

  const { productIds, quantitiesByProductId } = useStore(
    useCartStore,
    selectTenantSlice
  );

  // ─── Actions from store (plain bound hook usage is fine) ────────────────
  const addProductRaw = useCartStore((state) => state.addProduct);
  const removeProductRaw = useCartStore((state) => state.removeProduct);
  const clearCartRaw = useCartStore((state) => state.clearCart);
  const clearAllCartsForCurrentUser = useCartStore(
    (state) => state.clearAllCartsForCurrentUser
  );

  const addProduct = useCallback(
    (productId: string, quantity?: number) =>
      addProductRaw(tenant, productId, quantity),
    [tenant, addProductRaw]
  );

  const removeProduct = useCallback(
    (productId: string) => removeProductRaw(tenant, productId),
    [tenant, removeProductRaw]
  );

  const clearCart = useCallback(
    () => clearCartRaw(tenant),
    [tenant, clearCartRaw]
  );

  const toggleProduct = useCallback(
    (productId: string, quantity?: number) =>
      productIds.includes(productId)
        ? removeProduct(productId)
        : addProduct(productId, quantity),
    [productIds, removeProduct, addProduct]
  );

  const isProductInCart = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  );

  const totalItems = useMemo(() => {
    let sum = 0;
    for (const id of productIds) {
      const q = quantitiesByProductId[id];
      sum += q ?? 1;
    }
    return sum;
  }, [productIds, quantitiesByProductId]);

  return {
    productIds,
    totalItems,
    quantitiesByProductId,
    addProduct,
    removeProduct,
    clearCart,
    clearAllCartsForCurrentUser,
    toggleProduct,
    isProductInCart
  };
}

export default useCart;
