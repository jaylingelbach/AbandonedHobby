import { Carrier } from '@/constants';
import { Quantity } from '@/lib/validation/quantity';
import type { ShippingMode } from '@/modules/orders/types';

export type SellerOrderItem = {
  nameSnapshot: string;
  quantity: Quantity; // integer >= 1
  unitAmountCents: number; // item price in cents
  amountTotalCents: number; // line total in cents (price * quantity, excl. shipping/tax)
  lineItemId: string;
  // Optional shipping details per line (present when the order used shipping)
  shippingMode?: ShippingMode; // 'free' | 'flat' | 'calculated'
  shippingFeeCentsPerUnit?: number | null; // for 'flat' mode, per-unit fee in cents (sanitized, non-negative)
  shippingSubtotalCents?: number | null; // for 'flat' mode, quantity-adjusted shipping in cents (non-negative)
};

export type SellerOrderAmounts = {
  itemsSubtotalCents: number;
  shippingCents: number;
  discountCents: number;
  taxCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  grossTotalCents: number;
  sellerNetCents: number;
};

export type SellerOrderDetail = {
  id: string;
  orderNumber: string;
  createdAtISO: string;
  currency: string;

  buyerEmail?: string | null;

  shipping?: {
    name?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null; // ISO-2 code
  } | null;

  tracking?: {
    carrier?: Carrier | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippedAtISO?: string | null;
  } | null;

  items: SellerOrderItem[];

  amounts: SellerOrderAmounts;

  stripe?: {
    paymentIntentId?: string | null;
    chargeId?: string | null;
    receiptUrl?: string | null;
  };
};
