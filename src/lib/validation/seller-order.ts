import { z } from 'zod';
import {
  zCentsIntNonNegative,
  zCurrencyCode,
  zIsoString,
  zNullableString,
  zQuantityInt,
  zShippingMode
} from './seller-order-validation-types';

export const zSellerOrderItem = z.object({
  lineItemId: z.string().min(1),
  nameSnapshot: z.string().min(1),
  quantity: zQuantityInt, // integer >= 1
  unitAmountCents: zCentsIntNonNegative, // >= 0
  amountTotalCents: zCentsIntNonNegative, // >= 0

  // Optional shipping per line
  shippingMode: zShippingMode.optional(),
  shippingFeeCentsPerUnit: zCentsIntNonNegative.nullable().optional(),
  shippingSubtotalCents: zCentsIntNonNegative.nullable().optional()
});

export type SellerOrderItem = z.infer<typeof zSellerOrderItem>;

export const zSellerOrderDetail = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  createdAtISO: zIsoString,
  currency: zCurrencyCode,
  buyerEmail: zNullableString,
  shipping: z
    .object({
      name: zNullableString,
      address1: zNullableString,
      address2: zNullableString,
      city: zNullableString,
      state: zNullableString,
      postalCode: zNullableString,
      country: zNullableString
    })
    .nullable()
    .optional(),
  tracking: z
    .object({
      carrier: z.enum(['usps', 'ups', 'fedex', 'other']).nullable().optional(),
      trackingNumber: zNullableString,
      trackingUrl: zNullableString,
      shippedAtISO: zNullableString
    })
    .nullable()
    .optional(),
  items: z.array(zSellerOrderItem).min(1),
  amounts: z.object({
    itemsSubtotalCents: zCentsIntNonNegative,
    shippingCents: zCentsIntNonNegative,
    discountCents: zCentsIntNonNegative,
    taxCents: zCentsIntNonNegative,
    platformFeeCents: zCentsIntNonNegative,
    stripeFeeCents: zCentsIntNonNegative,
    grossTotalCents: zCentsIntNonNegative,
    sellerNetCents: zCentsIntNonNegative
  }),
  stripe: z
    .object({
      paymentIntentId: zNullableString,
      chargeId: zNullableString,
      receiptUrl: zNullableString
    })
    .optional()
});

export type SellerOrderDetail = z.infer<typeof zSellerOrderDetail>;
