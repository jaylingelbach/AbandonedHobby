import type { Quantity } from '@/lib/validation/quantity';
import type { ShippingMode } from '@/modules/orders/types';

export type ShippingSnapshot = {
  mode: ShippingMode; // 'free' | 'flat' | 'calculated'
  /** Only used when mode === 'flat'. Stored as integer cents per unit. */
  feeCentsPerUnit?: number;
};

export interface TenantCart {
  productIds: string[];
  /** Per-product quantity (units), validated as Quantity. */
  quantitiesByProductId?: Record<string, Quantity>;
  /** Per-product shipping snapshot captured at add-to-cart time. */
  shippingByProductId?: Record<string, ShippingSnapshot>;
}

export interface CartState {
  byUser: UserMap;
  currentUserKey: string;

  /** Capture or update a product's shipping snapshot for a tenant. */
  setProductShippingSnapshot: (
    tenantSlug: string | null | undefined,
    productId: string,
    mode: ShippingMode,
    feeCentsPerUnit?: number
  ) => void;

  setCurrentUserKey: (userId?: string | null) => void;

  addProduct: (
    tenantSlug: string | null | undefined,
    productId: string,
    quantity?: number
  ) => void;
  removeProduct: (
    tenantSlug: string | null | undefined,
    productId: string
  ) => void;
  clearCart: (tenantSlug: string | null | undefined) => void;
  /** clear by `${tenant}::${userKey}` without switching current user */
  clearCartForScope: (scopeKey: string) => void;
  clearAllCartsForCurrentUser: () => void;
  clearAllCartsEverywhere: () => void;
  migrateAnonToUser: (tenantSlug: string, newUserId: string) => void;

  __cleanupTenantKeys?: () => void;
}
export type TenantMap = Record<string, TenantCart>; // tenantSlug -> TenantCart
export type UserMap = Record<string, TenantMap>; // userKey -> TenantMap

export type CartMessage =
  | { type: 'CLEAR_CART'; userKey: string; tenantSlug: string }
  | { type: 'CLEAR_ALL_FOR_USER'; userKey: string }
  | { type: 'CLEAR_ALL_GLOBAL' };

export type TenantCartSlice = {
  productIds: string[];
  quantitiesByProductId: Record<string, number>;
};
