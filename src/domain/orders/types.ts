// Canonical, reusable order shapes for the whole app.

export type CurrencyCode = string; // e.g. "USD"

// ---- Core line item (superset, safe for most features)
export type OrderItemCore = {
  id: string;
  productId?: string | null;

  nameSnapshot?: string | null;

  // amounts in cents
  unitAmount: number; // required for math
  quantity: number; // required for math

  amountSubtotal?: number | null;
  amountTax?: number | null;
  amountTotal?: number | null;

  refundPolicy?: string | null;
  returnsAcceptedThrough?: string | null;
};

// ---- Core order (superset, safe for most features)
export type OrderCore = {
  id: string;

  orderNumber?: string;
  createdAt?: string | null;

  currency: CurrencyCode;
  total: number; // cents

  status?: 'paid' | 'partially_refunded' | 'refunded' | 'canceled' | string;

  refundedTotalCents?: number | null;
  lastRefundAt?: string | null;

  // Stripe-ish fields (optional in most flows)
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeAccountId?: string | null;

  items?: OrderItemCore[];
};

// ---- View models (derive exactly what each feature needs)

// Invoice view: keep shipping + a slim item read
export type ShippingAddress = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type OrderForInvoice = Pick<
  OrderCore,
  'id' | 'orderNumber' | 'createdAt' | 'currency' | 'total' | 'items'
> & {
  shipping?: ShippingAddress | null;
  returnsAcceptedThrough?: string | null;
  items?: Array<
    Pick<
      OrderItemCore,
      'nameSnapshot' | 'quantity' | 'unitAmount' | 'amountTotal'
    >
  >;
};

// Refund engine / UI: needs math-critical fields + refunded totals
export type OrderForRefunds = Pick<
  OrderCore,
  'id' | 'currency' | 'total' | 'refundedTotalCents' | 'items'
> & {
  items?: Array<
    Pick<
      OrderItemCore,
      | 'id'
      | 'unitAmount'
      | 'quantity'
      | 'amountTotal'
      | 'returnsAcceptedThrough'
      | 'refundPolicy'
    >
  >;
};
