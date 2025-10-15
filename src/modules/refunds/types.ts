// src/modules/refunds/types.ts

import type { OrderCore, OrderItemCore } from '@/domain/orders/types';

/* ---------- Items / Orders (UI-facing) ---------- */

export type OrderItem = {
  // Keep compatibility with existing consumers:
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

/** Server-side snapshot of the order for refund math/status */
export type OrderDoc = Pick<
  OrderCore,
  'id' | 'total' | 'status' | 'refundedTotalCents' | 'lastRefundAt'
> & {
  // Keep optionality consistent with callers:
  total: number; // cents
};

/** Some callers patch totals after recompute */
export type OrderWithTotals = OrderLike & {
  total?: number | null;
  refundedTotalCents?: number | null;
};

/* ---------- Refund selections ---------- */

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

/** Exactly one of quantity OR amountCents */
export type LineSelection = LineSelectionQty | LineSelectionAmount;

/* ---------- Engine options / statuses ---------- */

export type EngineOptions = {
  reason?: StripeRefundReason;
  restockingFeeCents?: number; // optional negative adjustment
  refundShippingCents?: number; // include shipping in refund
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

/* ---------- Persistence docs ---------- */

export type RefundDoc = {
  id: string;
  order: string | { id: string };
  amount: number; // cents
  status: LocalRefundStatus;
  createdAt?: string;
  updatedAt?: string;
};

/* ---------- UI refund line model ---------- */

export type RefundLine = {
  itemId: string;
  name: string;
  unitAmount: number; // cents
  quantityPurchased: number;
  quantitySelected: number; // controlled by the UI
  amountTotal?: number; // optional line total (tax/discount incl)
};

/* ---------- Narrow re-exports (optional helpers) ---------- */
/** If you ever need the canonical shapes directly in refunds code: */
export type CanonicalOrder = OrderCore;
export type CanonicalOrderItem = OrderItemCore;
