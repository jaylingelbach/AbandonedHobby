// hooks/use-cart.ts
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '../store/use-cart-store';

const DEFAULT_TENANT = '__global__';
const ANON_PREFIX = 'anon:';
const DEVICE_ID_KEY = 'ah_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated =
    (typeof crypto !== 'undefined' &&
      'randomUUID' in crypto &&
      crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`;
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

function userKey(userId?: string | null): string {
  const trimmed = (userId ?? '').trim();
  if (trimmed.includes('::')) {
    throw new Error('userId cannot contain "::" separator');
  }

  return trimmed.length > 0
    ? trimmed
    : `${ANON_PREFIX}${getOrCreateDeviceId()}`;
}

function tenantKey(tenantSlug?: string | null): string {
  const trimmed = (tenantSlug ?? '').trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_TENANT;
}

/** Compose a unique key per-tenant-per-user */
function scopeKey(tenantSlug?: string | null, userId?: string | null): string {
  return `${tenantKey(tenantSlug)}::${userKey(userId)}`;
}

export const useCart = (tenantSlug?: string | null, userId?: string | null) => {
  // composite scope
  const scope = useMemo(
    () => scopeKey(tenantSlug, userId),
    [tenantSlug, userId]
  );

  // actions (match the per-user store API)
  const addProduct = useCartStore((s) => s.addProduct);
  const removeProduct = useCartStore((s) => s.removeProduct);
  const clearCart = useCartStore((s) => s.clearCart);
  const clearAllCartsForCurrentUser = useCartStore(
    (s) => s.clearAllCartsForCurrentUser
  );

  // ✅ selector updated to per-user shape: byUser[currentUserKey][scope].productIds
  const productIds = useCartStore(
    useShallow((s) => {
      const userBucket = s.byUser[s.currentUserKey];
      return (userBucket?.[scope]?.productIds ?? []) as string[];
    })
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
    (productId: string) => {
      return productIds.includes(productId);
    },
    [productIds]
  );

  return {
    productIds,
    addProduct: handleAddProduct,
    removeProduct: handleRemoveProduct,
    clearCart: clearTenantCart,
    clearAllCartsForCurrentUser,
    toggleProduct,
    isProductInCart,
    totalItems: productIds.length
  };
};
