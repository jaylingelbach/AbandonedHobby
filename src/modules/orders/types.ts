import { Carrier } from '@/constants';

export type ShippingMode = 'free' | 'flat' | 'calculated';

export interface OrderItemCore {
  product: string; // or Product
  nameSnapshot: string;
  unitAmountCents: number;
  quantity: number; // positive int

  // NEW:
  shippingMode: ShippingMode;
  shippingFeeCentsPerUnit?: number; // only when shippingMode === 'flat'
  shippingSubtotalCents: number; // per-line, quantity-applied
}

export interface OrderAmounts {
  itemsSubtotalCents: number;
  shippingTotalCents: number;
  discountTotalCents: number;
  taxTotalCents: number;
  totalCents: number; // itemsSubtotalCents + shippingTotalCents - discountTotalCents + taxTotalCents
}

export interface OrderForBuyer {
  items: OrderItemCore[];
  amounts: OrderAmounts;
}

export type ShippingAddress = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null; // ISO-2
};

export type ShippedOrderListItem = {
  orderId: string;
  orderNumber: string;
  currency?: string;
  orderDateISO: string;
  shippedAtISO: string;
  totalCents: number;
  carrier?: Carrier;
  trackingNumber?: string;
};

export type OrderListItem = {
  orderId: string;
  orderNumber: string;
  orderDateISO: string;
  totalCents: number;
  currency: string;
  productId: string;
  productName: string;
  productImageURL?: string;
  tenantSlug?: string;
};

export type OrderItemDTO = {
  productId: string;
  name: string;
  quantity: number; // positive int
  unitAmountCents: number; // unit price (cents)
  amountSubtotalCents: number; // subtotal for this line (cents)
  amountTaxCents: number | null; // may be null if not collected
  amountTotalCents: number; // total for this line (cents)
  thumbnailUrl?: string | null; // optional if you snapshot it
  returnsAcceptedThroughISO: string | null;
};

export type OrderConfirmationDTO = {
  orderId: string;
  orderNumber: string;
  orderDateISO: string; // createdAt
  currency: string;
  totalCents: number;
  returnsAcceptedThroughISO: string | null; // order-level cutoff (earliest return date among all items)
  receiptUrl?: string | null; // if you attach one later
  tenantSlug?: string | null; // nice for CTAs
  items: OrderItemDTO[]; // full receipt lines
  shipping?: ShippingAddress;
  status?: string;
};

export type OrderSummaryDTO = {
  orderId: string;
  orderNumber: string;
  orderDateISO: string;
  returnsAcceptedThroughISO: string | null;
  currency: string;
  totalCents: number;
  quantity: number;
  productId: string;
  productIds?: string[]; // All product IDs in the order when multiple items exist
  shipping?: ShippingAddress;
  items?: OrderItemDTO[];
  shipment?: ShipmentDTO;
};

export type ShipmentDTO = {
  carrier?: Carrier;
  trackingNumber: string | null;
  shippedAtISO: string | null;
};

type BaseOrderSummaryProps = {
  orderDate: string | Date;
  orderNumber: string;
  returnsAcceptedThrough?: string | Date | null;
  quantity?: number;
  className?: string;
  shipping?: ShippingAddress;
};

// EITHER dollars (your old way) OR cents (from DB/Stripe)
export type DollarsVariant = BaseOrderSummaryProps & {
  totalPaid: number; // dollars
  totalCents?: never;
  currency?: never;
};
export type CentsVariant = BaseOrderSummaryProps & {
  totalCents: number; // cents
  currency?: string; // optional, reserved for future
  totalPaid?: never;
};

export type CartItemForShipping = {
  id: string;
  name: string;
  quantity: number;
  shippingMode: ShippingMode;
  shippingFeeCentsPerUnit?: number; // cents, only for 'flat'
};

export type SidebarShippingLine = {
  id: string;
  label: string;
  amountCents: number; // per-item, quantity=1 in your cart
  mode: ShippingMode;
};

export type OrderSummaryCardProps = DollarsVariant | CentsVariant;
