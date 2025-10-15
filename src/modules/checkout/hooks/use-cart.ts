'use client';

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';

const DEFAULT_TENANT = '__global__';

// Keep storage shape stable: strip any accidental "::user" suffix
function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return DEFAULT_TENANT;
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(0, i) : s;
}

/**
 * useCart(tenantSlug, userId?)
 * - userId is accepted for convenience but ignored (store is tenant-scoped).
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
  const productIds = useCartStore(
    useShallow(
      (s) =>
        (s.byUser[s.currentUserKey]?.[tenant]?.productIds ?? []) as string[]
    )
  );

  // stable wrappers
  const addProduct = useCallback(
    (productId: string) => addProductRaw(tenant, productId),
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
    (productId: string) =>
      productIds.includes(productId)
        ? removeProduct(productId)
        : addProduct(productId),
    [productIds, removeProduct, addProduct]
  );

  const isProductInCart = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  );

  return {
    productIds,
    totalItems: productIds.length,
    addProduct,
    removeProduct,
    clearCart,
    clearAllCartsForCurrentUser,
    toggleProduct,
    isProductInCart
  };
}

export default useCart;
