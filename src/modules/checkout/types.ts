import Stripe from 'stripe';
import { ShippingMode } from '../orders/types';

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
  /** 'free' | 'flat' | 'calculated' */
  shippingMode?: ShippingMode;
  /** cents per unit when flat */
  shippingFeeCentsPerUnit?: number;
  /** flat fee in cents (per unit) */
  shippingFlatFeeCents?: number;
  /** legacy USD flat fee; will be converted to cents */
  shippingFlatFee?: number | null;
}
