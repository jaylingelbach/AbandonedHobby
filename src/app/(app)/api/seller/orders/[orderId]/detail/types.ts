import { Carrier } from '@/constants';

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
    country?: string | null;
  } | null;
  tracking?: {
    carrier?: Carrier | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippedAtISO?: string | null;
  } | null;
  items: Array<{
    nameSnapshot: string;
    quantity: number;
    unitAmountCents: number;
    amountTotalCents: number;
  }>;
  amounts: {
    itemsSubtotalCents: number;
    shippingCents: number;
    discountCents: number;
    taxCents: number;
    platformFeeCents: number;
    stripeFeeCents: number;
    grossTotalCents: number;
    sellerNetCents: number;
  };
  stripe?: {
    paymentIntentId?: string | null;
    chargeId?: string | null;
    receiptUrl?: string | null;
  };
};
