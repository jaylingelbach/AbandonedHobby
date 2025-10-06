export type OrderItemLite = {
  id: string;
  nameSnapshot?: string;
  unitAmount?: number; // cents
  quantity?: number;
  amountTotal?: number; // cents
};

export type OrderLite = {
  id: string;
  items?: OrderItemLite[];
  refundedTotalCents?: number; // cents
  total: number; // cents
  currency?: string | null;
};

export type RefundLine = {
  itemId: string;
  name: string;
  unitAmount: number; // cents
  quantityPurchased: number;
  quantitySelected: number;
  amountTotal?: number; // cents
};

export type RefundReason =
  | 'requested_by_customer'
  | 'duplicate'
  | 'fraudulent'
  | 'other';

export type RefundPostBody = {
  orderId: string;
  selections: Array<{ itemId: string; quantity: number }>;
  reason?: RefundReason;
  restockingFeeCents?: number;
  refundShippingCents?: number;
  idempotencyKey?: string;
};

export type RefundPostResult =
  | {
      ok: true;
      stripeRefundId: string;
      status: string;
      amount: number;
      refundId: string;
    }
  | {
      ok: false;
      error: string;
      code: 'ALREADY_FULLY_REFUNDED' | 'EXCEEDS_REMAINING' | 'FORBIDDEN';
    };
