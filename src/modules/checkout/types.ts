import Stripe from 'stripe';

export type ProductMetadata = {
  stripeAccountId: string;
  id: string;
  name: string;
  price: number;
};

export type CheckoutMetadata = {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  sellerStripeAccountId: string;
  productIds: string; // comma-separated list, as stored in Session.metadata
};

export type ExpandedLineItem = Stripe.LineItem & {
  price: Stripe.Price & {
    product: Stripe.Product & {
      metadata: ProductMetadata;
    };
  };
};

export interface ProductWithShipping {
  shippingMode?: 'free' | 'flat' | 'calculated';
  shippingFeeCentsPerUnit?: number;
  shippingFlatFeeCents?: number;
}
