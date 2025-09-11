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
};
