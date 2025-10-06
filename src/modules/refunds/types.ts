export type OrderItem = {
  id?: string;
  product?: string | { id?: string };
  nameSnapshot?: string;
  unitAmount?: number; // cents
  quantity?: number;
  amountSubtotal?: number; // cents
  amountTax?: number; // cents
  amountTotal?: number; // cents
  refundPolicy?: string;
  returnsAcceptedThrough?: string;
};

export type OrderLike = {
  id: string;
  orderNumber: string;
  currency: string;
  total: number; // cents
  items?: OrderItem[];
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeAccountId: string;
};

export type LineSelection = { itemId: string; quantity: number };

export type EngineOptions = {
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other';
  restockingFeeCents?: number; // optional negative adjustment
  refundShippingCents?: number; // if you want to include shipping
  notes?: string;
  // Idempotency key override when you need a stable custom key
  idempotencyKey?: string;
};

export type StripeRefundReason =
  | 'requested_by_customer'
  | 'duplicate'
  | 'fraudulent'
  | 'other';

export type LocalRefundStatus = 'succeeded' | 'pending' | 'failed' | 'canceled';

export type RefundDoc = {
  id: string;
  order: string | { id: string };
  amount: number; // cents
  status: 'succeeded' | 'pending' | 'failed' | 'canceled';
  createdAt?: string;
  updatedAt?: string;
};

export type OrderDoc = {
  id: string;
  total: number; // cents
  status: 'paid' | 'partially_refunded' | 'refunded' | 'canceled';
  refundedTotalCents?: number;
  lastRefundAt?: string | null;
};

export type OrderWithTotals = OrderLike & {
  total?: number | null;
  refundedTotalCents?: number | null;
};

export type RefundLine = {
  itemId: string;
  name: string;
  unitAmount: number; // cents
  quantityPurchased: number;
  quantitySelected: number; // controlled by the UI
  amountTotal?: number; // optional line total (tax/discount incl)
};
