'use client';

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';

const DEFAULT_TENANT = '__global__';

// Keep storage shape stable: strip any accidental "::user" suffix
/**
 * Normalize a tenant slug by trimming whitespace, removing any "::" suffix and its trailing content, and defaulting to DEFAULT_TENANT when empty.
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
 *  - `totalItems`: number of items in `productIds`,
 *  - `addProduct(productId)`: adds a product to this tenant's cart,
 *  - `removeProduct(productId)`: removes a product from this tenant's cart,
 *  - `clearCart()`: clears this tenant's cart,
 *  - `clearAllCartsForCurrentUser()`: clears all carts for the current user,
 *  - `toggleProduct(productId)`: adds the product if absent or removes it if present,
 *  - `isProductInCart(productId)`: returns `true` if the product is in the cart, `false` otherwise
 */

export function useCart(tenantSlug?: string | null, _userId?: string | null) {
  void _userId;
  const tenant = useMemo(() => normalizeTenantSlug(tenantSlug), [tenantSlug]);

  // actions from store
  const addProductRaw = useCartStore((s) => s.addProduct);
  const removeProductRaw = useCartStore((s) => s.removeProduct);
  const clearCartRaw = useCartStore((s) => s.clearCart);
  const clearAllCartsForCurrentUser = useCartStore(
    (s) => s.clearAllCartsForCurrentUser
  );

  // read current productIds for this tenant
  const { productIds, quantitiesByProductId } = useCartStore(
    useShallow((s) => {
      const bucket = s.byUser[s.currentUserKey]?.[tenant];
      return {
        productIds: (bucket?.productIds ?? []) as string[],
        quantitiesByProductId: (bucket?.quantitiesByProductId ?? {}) as Record<
          string,
          number
        >
      };
    })
  );

  // stable wrappers
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
    // Sum units by product; default to 1 for legacy carts with no quantity map.
    return productIds.reduce((sum, productId) => {
      const q = quantitiesByProductId[productId];
      const safe =
        typeof q === 'number' && Number.isFinite(q) && q > 0
          ? Math.trunc(q)
          : 1;
      return sum + safe;
    }, 0);
  }, [productIds, quantitiesByProductId]);

  return {
    productIds,
    totalItems,
    addProduct,
    removeProduct,
    clearCart,
    clearAllCartsForCurrentUser,
    toggleProduct,
    isProductInCart
  };
}

export default useCart;
