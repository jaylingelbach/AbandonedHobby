import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useCartStore } from '../store/use-cart-store';

/** Keep this in sync with the store’s normalization if you exported it there */
const DEFAULT_SCOPE = '__global__';
function normalizeTenantSlug(raw?: string | null): string {
  const s = (raw ?? '').trim();
  return s.length > 0 ? s : DEFAULT_SCOPE;
}

/**
 * useCart
 * - Works even if tenantSlug is undefined/null by falling back to a default scope
 * - Exposes the same API already in use
 */
export const useCart = (tenantSlug?: string | null) => {
  const scope = useMemo(() => normalizeTenantSlug(tenantSlug), [tenantSlug]);

  // actions
  const addProduct = useCartStore((state) => state.addProduct);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const clearCart = useCartStore((state) => state.clearCart);
  const clearAllCarts = useCartStore((state) => state.clearAllCarts);

  // reactive list for this scope
  const productIds = useCartStore(
    useShallow((state) => state.tenantCarts[scope]?.productIds ?? [])
  );

  const handleAddProduct = useCallback(
    (productId: string) => {
      addProduct(scope, productId);
    },
    [addProduct, scope]
  );

  const handleRemoveProduct = useCallback(
    (productId: string) => {
      removeProduct(scope, productId);
    },
    [removeProduct, scope]
  );

  const clearTenantCart = useCallback(() => {
    clearCart(scope);
  }, [clearCart, scope]);

  const toggleProduct = useCallback(
    (productId: string) => {
      if (productIds.includes(productId)) {
        removeProduct(scope, productId);
      } else {
        addProduct(scope, productId);
      }
    },
    [productIds, addProduct, removeProduct, scope]
  );

  const isProductInCart = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  );

  return {
    productIds,
    addProduct: handleAddProduct,
    removeProduct: handleRemoveProduct,
    clearCart: clearTenantCart,
    clearAllCarts,
    toggleProduct,
    isProductInCart,
    totalItems: productIds.length
  };
};
