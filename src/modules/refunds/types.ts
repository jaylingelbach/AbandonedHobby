import { OrderItem } from '../library/ui/components/types';

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
