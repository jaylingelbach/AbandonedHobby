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
  status?: string;
};

export type RefundLine = {
  itemId: string;
  name: string;
  unitAmount: number; // cents
  quantityPurchased: number;
  quantitySelected: number;
  amountTotal?: number; // cents
};
// API expects individual refund selections by either quantity or amount
export type LineSelection =
  | { itemId: string; quantity: number; amountCents?: never }
  | { itemId: string; amountCents: number; quantity?: never };

export type RefundReason =
  | 'requested_by_customer'
  | 'duplicate'
  | 'fraudulent'
  | 'other';

export type RefundPostBody = {
  orderId: string;
  selections: LineSelection[];
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
