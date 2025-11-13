import Stripe from 'stripe';
import { ShippingMode } from '../orders/types';

export type ProductMetadata = {
  stripeAccountId: string;
  id: string;
  name: string;
  price: number;
};

export type CheckoutMetadata = {
  userRef: string; // attemptId
  tenantId: string;
  tenantSlug: string;
  sellerStripeAccountId: string;
  productIds: string;
  shippingCents: string;
  ah_fee_basis: 'items-subtotal';
  ah_items_subtotal_cents: string;
  ah_platform_fee_cents_intended: string;
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

export type ShippingModeUnion = 'free' | 'flat' | 'calculated';
