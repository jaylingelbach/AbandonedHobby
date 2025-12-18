import { CartItemForShipping, ShippingMode } from '@/modules/orders/types';
import { Media, Product } from '@/payload-types';

// union for identity helper return
export type CartIdentity =
  | { kind: 'user'; userId: string; guestSessionId: string | null }
  | { kind: 'guest'; userId: null; guestSessionId: string };

// One line in the cart
export type CartItemDTO = {
  /** Stable ID for the line (DB row id if it exists, or a synthetic one if not) */
  lineId: string;
  /** Product ID in Payload */
  productId: string;
  /** Snapshot of the product name at time of add */
  name: string;
  /** Quantity of this product in the cart */
  quantity: number;
  /** Price per unit (in cents) at time of add */
  unitAmountCents: number;
  /** Convenience: unitAmountCents * quantity (in cents) */
  lineSubtotalCents: number;
  /** Optional: URL for the snapshot image */
  imageUrl?: string | null;
  /** Shipping mode snapshot for this product (if you care later) */
  shippingModeSnapshot?: 'free' | 'flat' | 'calculated' | null;
};

// Whole cart for a single tenant
export type CartDTO = {
  /** null when the cart doesn’t exist in Payload yet (virtual cart) */
  cartId: string | null;

  /** Tenant slug you asked for in .input({ tenantSlug }) */
  tenantSlug: string | null;

  /** Optional: tenant id if you look it up; handy for checkout */
  tenantId: string | null;

  /**
   * How many distinct lines are in the cart (items.length).
   * This is “number of different products”, not total quantity.
   */
  distinctItemCount: number;

  /**
   * Sum of all quantities across items.
   */
  totalQuantity: number;

  /** Sum of lineSubtotalCents across all items (items only, no shipping/tax). */
  totalApproxCents: number;

  /** Currency for all money fields; for now just 'USD'. */
  currency: 'USD';

  /** The items themselves */
  items: CartItemDTO[];
};

export type CartItem = {
  product: string | Product;
  nameSnapshot: string;
  unitAmountCents: number;
  quantity: number;
  addedAt?: string | null;
  imageSnapshot?: string | null | Media;
  shippingModeSnapshot?: ShippingMode | null;
};

export type CartItemSnapshots = {
  nameSnapshot: string;
  unitAmountCentsSnapshot: number;
  imageSnapshot?: Media | string | null;
  shippingModeSnapshot?: ShippingMode | null;
};

export type CartSummaryDTO = {
  totalQuantity: number;
  distinctItemCount: number;
  activeCartCount: number;
};

export type CartToUpdate = {
  cartId: string;
  newItems: CartItem[];
};

export type PruneSummary = {
  cartsToUpdate: CartToUpdate[];
  cartsScanned: number;
  itemsRemovedByProductId: number;
  itemsRemovedMalformed: number;
};

export type IdentityForMerge = {
  userId: string;
  guestSessionId: string | null;
};

export interface TenantCheckoutGroup {
  /** Normalized tenant key */
  tenantKey: string | null;
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
  flatFeeShippingCents: number;
  /** Subtotal + shipping in cents */
  totalCents: number;
  /** Per-item shipping breakdown for this tenant */
  breakdownItems: CartItemForShipping[];
  /** True when any item in this group uses “calculated” shipping */
  hasCalculatedShipping: boolean;
}
