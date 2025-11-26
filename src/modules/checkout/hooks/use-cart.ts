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

const DEFAULT_TENANT = '__global__';

// Prefer a configurable default currency, with USD as a safe fallback.
const DEFAULT_CURRENCY =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.toUpperCase() ?? 'USD';

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

/**
 * Normalize and sanitize a raw quantities map into a mapping of product IDs to positive integer quantities.
 *
 * @param raw - A raw value (typically an object) mapping product IDs to quantities; any non-object value is treated as empty.
 * @returns A `Record<string, number>` containing only entries whose values are finite integers greater than zero. If no valid entries exist, an empty mapping is returned. The result may be cached and reused for the same input object reference.
 */
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

  const safe: Record<string, number> = {};
  let hasInvalid = false;
  for (const [key, value] of entries) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isInteger(value)
    ) {
      hasInvalid = true;
      continue;
    }
    safe[key] = value;
  }

  if (!hasInvalid && Object.keys(safe).length === entries.length) {
    const typed = map as Record<string, number>;
    quantityCache.set(map, typed);
    return typed;
  }

  const normalized = Object.keys(safe).length > 0 ? safe : EMPTY_QUANTITIES;
  quantityCache.set(map, normalized);
  return normalized;
}

function buildTenantSummaries(state: CartState): TenantCartSummary[] {
  const currentUserKey = state.currentUserKey;
  const byTenant = state.byUser[currentUserKey] ?? {};

  const summaries: TenantCartSummary[] = [];

  for (const [tenantKey, bucket] of Object.entries(byTenant)) {
    const productIds = Array.isArray(bucket.productIds)
      ? bucket.productIds
      : EMPTY_PRODUCT_IDS;

    const quantitiesByProductId = sanitizeQuantities(
      bucket.quantitiesByProductId
    );

    if (productIds.length === 0) continue;

    summaries.push({
      tenantKey,
      productIds,
      quantitiesByProductId
    });
  }

  return summaries;
}

/**
 * Read all tenant carts for the current user from the Zustand store.
 *
 * We subscribe manually instead of using the Zustand React hook, so we
 * avoid useSyncExternalStore / getServerSnapshot quirks in Next 15.
 */
export function useAllTenantCarts(): TenantCartSummary[] {
  const [summaries, setSummaries] = useState<TenantCartSummary[]>(() =>
    buildTenantSummaries(useCartStore.getState())
  );

  useEffect(() => {
    const unsubscribe = useCartStore.subscribe((state) => {
      setSummaries(buildTenantSummaries(state));
    });
    return unsubscribe;
  }, []);

  return summaries;
}

/**
 * Provide tenant-scoped cart state and actions for the current user.
 *
 * The hook reads the cart bucket for the normalized tenant slug and exposes
 * product identifiers, per-product quantities, derived totals, and action
 * helpers that are bound to that tenant.
 *
 * @param tenantSlug - Tenant identifier that will be normalized (trimmed, `::...` suffix removed, and defaulted when empty) to select the tenant-scoped cart
 * - (User identity for analytics is managed separately via AnalyticsIdentityBridge)
 * @returns An object containing:
 *  - `productIds`: the ordered array of product IDs in the tenant's cart
 *  - `totalItems`: the sum of quantities for all listed product IDs (defaults each missing quantity to 1)
 *  - `quantitiesByProductId`: a sanitized map of product ID → quantity (only positive integer quantities are kept)
 *  - `addProduct(productId, quantity?)`: add or update a product with an optional quantity
 *  - `removeProduct(productId)`: remove a product from the cart
 *  - `clearCart()`: remove all products for the current tenant
 *  - `clearAllCartsForCurrentUser()`: clear all tenant carts for the current user
 *  - `toggleProduct(productId, quantity?)`: add (with optional quantity) if not present, otherwise remove
 *  - `isProductInCart(productId)`: returns `true` if the product ID is currently in the cart, `false` otherwise
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
