'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  CartLineForAnalytics,
  trackCartUpdated
} from '../analytics/cart-analytics';

import { useCartStore } from '@/modules/checkout/store/use-cart-store';

import type { CartState, TenantCartSlice } from '../store/types';
import type { TenantCartSummary } from './types';
import { normalizeTenantSlug } from '../store/utils';
import {
  buildTenantSummaries,
  sanitizeQuantities,
  selectGlobalCartItemCount
} from './utils';

// Prefer a configurable default currency, with USD as a safe fallback.
const DEFAULT_CURRENCY =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.toUpperCase() ?? 'USD';

const EMPTY_PRODUCT_IDS: string[] = [];
const EMPTY_QUANTITIES: Record<string, number> = {};

const EMPTY_SLICE: TenantCartSlice = {
  productIds: EMPTY_PRODUCT_IDS,
  quantitiesByProductId: EMPTY_QUANTITIES
};

/**
 * Provide a live array of tenant-scoped cart summaries for the current user.
 *
 * @returns An array of TenantCartSummary objects representing each tenant's cart for the current user
 */
export function useAllTenantCarts(): TenantCartSummary[] {
  const [summaries, setSummaries] = useState<TenantCartSummary[]>(() =>
    buildTenantSummaries(useCartStore.getState())
  );

  useEffect(() => {
    const unsubscribe = useCartStore.subscribe((state) => {
      setSummaries((prev) => {
        const next = buildTenantSummaries(state);
        // Shallow compare to avoid unnecessary re-renders
        if (
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              next[i] &&
              p.tenantKey === next[i].tenantKey &&
              p.productIds === next[i].productIds &&
              p.quantitiesByProductId === next[i].quantitiesByProductId
          )
        ) {
          return prev;
        }
        return next;
      });
    });
    return unsubscribe;
  }, []);

  return summaries;
}

/**
 * Exposes tenant-scoped cart state and tenant-bound action helpers for the current user.
 *
 * The hook selects the cart bucket for the normalized tenant slug and provides the ordered
 * product IDs, a sanitized quantities map, derived totals, and action functions scoped to that tenant.
 *
 * @param tenantSlug - Optional tenant identifier; will be normalized (trimmed, `::...` suffix removed, and defaulted when empty) to select the tenant-scoped cart
 * @returns An object with:
 *  - `productIds`: the ordered array of product IDs in the tenant's cart
 *  - `totalItems`: the sum of quantities for all listed product IDs (missing quantities default to 1)
 *  - `quantitiesByProductId`: sanitized map of product ID → positive integer quantity
 *  - `addProduct(productId, quantity?)`: add or update a product with an optional quantity (scoped to the selected tenant)
 *  - `removeProduct(productId)`: remove a product from the selected tenant's cart
 *  - `clearCart()`: remove all products for the selected tenant
 *  - `clearAllCartsForCurrentUser()`: clear all tenant carts for the current user
 *  - `toggleProduct(productId, quantity?)`: add (with optional quantity) if not present, otherwise remove (scoped to the selected tenant)
 *  - `isProductInCart(productId)`: `true` if the product ID is currently in the selected tenant's cart, `false` otherwise
 */

export function useCart(tenantSlug?: string | null) {
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

  // Idiomatic Zustand: bound store + useShallow wrapper
  const { productIds, quantitiesByProductId } = useCartStore(
    useShallow(selectTenantSliceBase)
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

  // ─── Analytics: cartUpdated on cart changes (debounced) ────────────────
  const CART_ANALYTICS_DEBOUNCE_MS = 400;

  useEffect(() => {
    if (productIds.length === 0) return;

    const lines: CartLineForAnalytics[] = productIds.map((productId) => ({
      productId,
      quantity: quantitiesByProductId[productId] ?? 1,
      // Prices are not available here; leave undefined.
      unitAmountCents: undefined
    }));

    const timeoutId = window.setTimeout(() => {
      trackCartUpdated({
        tenantSlug: tenant,
        // userId is intentionally omitted: PostHog identity comes from AnalyticsIdentityBridge
        lines,
        currency: DEFAULT_CURRENCY
      });
    }, CART_ANALYTICS_DEBOUNCE_MS);

    // Cancel if cart changes again quickly (debounce)
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [tenant, productIds, quantitiesByProductId]);

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

/**
 * Exposes the current total item count across all tenant-scoped carts for the active user.
 *
 * @returns The sum of quantities for every product in every tenant cart for the current user
 */
export function useCartBadgeCount(): number {
  return useCartStore(selectGlobalCartItemCount);
}