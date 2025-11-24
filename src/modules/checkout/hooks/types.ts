import { CartItemForShipping } from '@/modules/orders/types';
import { Product } from '@/payload-types';

export interface TenantCheckoutGroup {
  /** Normalized tenant key from the cart store (e.g. '__global__' or 'my-tenant') */
  tenantKey: string;
  /** Slug resolved from the product tenant relationship, when available */
  tenantSlug: string | null;
  /** Human-friendly name for the shop */
  tenantName: string;
  /** Products in this tenant’s cart */
  products: Product[];
  /** Quantities for each product, by id */
  quantitiesByProductId: Record<string, number>;
  /** Subtotal (items only) in cents */
  subtotalCents: number;
  /** Shipping total in cents (flat-fee portion only) */
  shippingCents: number;
  /** Subtotal + shipping in cents */
  totalCents: number;
  /** Per-item shipping breakdown for this tenant */
  breakdownItems: CartItemForShipping[];
  /** True when any item in this group uses “calculated” shipping */
  hasCalculatedShipping: boolean;
}

export interface MultiTenantCheckoutData {
  groups: TenantCheckoutGroup[];
  grandSubtotalCents: number;
  grandShippingCents: number;
  grandTotalCents: number;
}

export type TenantCartSummary = {
  tenantKey: string;
  productIds: string[];
  quantitiesByProductId: Record<string, number>;
};
