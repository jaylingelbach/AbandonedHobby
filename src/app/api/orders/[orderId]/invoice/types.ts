import type { OrderCore, OrderItemCore } from '@/domain/orders/types';

export type OrderItem = OrderItemCore;

export type OrderLike = Pick<
  OrderCore,
  | 'id'
  | 'orderNumber'
  | 'currency'
  | 'total'
  | 'items'
  | 'stripePaymentIntentId'
  | 'stripeChargeId'
  | 'stripeAccountId'
>;

export type OrderDoc = Pick<
  OrderCore,
  'id' | 'total' | 'status' | 'refundedTotalCents' | 'lastRefundAt'
>;

export type OrderWithTotals = OrderLike & {
  total?: number | null;
  refundedTotalCents?: number | null;
};

export type RefundLine = {
  itemId: string;
  name: string;
  unitAmount: number; // cents
  quantityPurchased: number;
  quantitySelected: number;
  amountTotal?: number; // cents
};

// (rest of your refund types unchanged)
export type LineSelectionQty = {
  itemId: string;
  quantity: number;
  amountCents?: undefined;
};
export type LineSelectionAmount = {
  itemId: string;
  amountCents: number;
  quantity?: undefined;
};
export type LineSelection = LineSelectionQty | LineSelectionAmount;

export type EngineOptions = {
  reason?: StripeRefundReason;
  restockingFeeCents?: number;
  refundShippingCents?: number;
  notes?: string;
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
  status: LocalRefundStatus;
  createdAt?: string;
  updatedAt?: string;
};
