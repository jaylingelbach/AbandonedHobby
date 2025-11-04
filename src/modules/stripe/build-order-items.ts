import { daysForPolicy } from '@/lib/server/utils';
import type { Product } from '@/payload-types';

import {
  type ExpandedLineItem,
  requireStripeProductIdFromLine
} from './guards';

import type Stripe from 'stripe';

/** RefundPolicy type from Product, excluding null. */
type RefundPolicy = Exclude<Product['refundPolicy'], null>;

export type ShippingMode = 'free' | 'flat' | 'calculated';

export type OrderItemOutput = {
  product: string;
  nameSnapshot: string;
  unitAmount: number; // cents
  quantity: number;
  amountSubtotal: number; // cents
  amountTax?: number; // cents
  amountTotal: number; // cents
  refundPolicy?: RefundPolicy;
  returnsAcceptedThrough?: string; // ISO
  thumbnailUrl?: string | null;
  shippingMode: ShippingMode;
  shippingFeeCentsPerUnit?: number;
  shippingSubtotalCents?: number;
};

const usdToCents = (usd: unknown, fallback = 0): number =>
  typeof usd === 'number' && Number.isFinite(usd)
    ? Math.max(0, Math.round(usd * 100))
    : Math.max(0, Math.round(fallback));

/**
 * Convert one expanded Stripe line item into our canonical OrderItem shape.
 * Uses `productMap` to pull refundPolicy (and optionally thumbnail later if desired).
 */
export function toOrderItemFromLine(
  line: ExpandedLineItem,
  productMap: Map<string, Product>
): OrderItemOutput {
  const productId = requireStripeProductIdFromLine(line);
  const productDoc = productMap.get(productId);

  const quantity = typeof line.quantity === 'number' ? line.quantity : 1;
  const unitAmount = line.price.unit_amount ?? 0;

  const amountSubtotal =
    typeof line.amount_subtotal === 'number'
      ? line.amount_subtotal
      : unitAmount * quantity;

  const amountTotal =
    typeof line.amount_total === 'number'
      ? line.amount_total
      : unitAmount * quantity;

  const amountTax =
    typeof line.amount_tax === 'number' ? line.amount_tax : undefined;

  const product = line.price.product as Stripe.Product;
  const nameSnapshot = product.name ?? line.description ?? 'Item';

  // Refund window
  const policy: RefundPolicy | undefined =
    productDoc?.refundPolicy ?? undefined;
  let returnsAcceptedThrough: string | undefined;
  if (policy) {
    const days = daysForPolicy(policy);
    if (days > 0) {
      returnsAcceptedThrough = new Date(
        Date.now() + days * 86_400_000
      ).toISOString();
    }
  }

  // --- shipping snapshot from Product ---------------------------------
  const rawMode = productDoc?.shippingMode;
  const shippingMode: ShippingMode =
    rawMode === 'free' || rawMode === 'flat' || rawMode === 'calculated'
      ? rawMode
      : 'free';

  const shippingFeeCentsPerUnit =
    shippingMode === 'flat'
      ? usdToCents(productDoc?.shippingFlatFee, 0)
      : undefined;

  const shippingSubtotalCents =
    shippingMode === 'flat' && typeof shippingFeeCentsPerUnit === 'number'
      ? shippingFeeCentsPerUnit * quantity
      : undefined;

  return {
    product: productId,
    nameSnapshot,
    unitAmount,
    quantity,
    amountSubtotal,
    amountTax,
    amountTotal,
    refundPolicy: policy,
    returnsAcceptedThrough,
    shippingMode,
    shippingFeeCentsPerUnit,
    shippingSubtotalCents
  };
}

/**
 * Build all order items from expanded Stripe line items.
 */
export function buildOrderItems(
  lines: ExpandedLineItem[],
  productMap: Map<string, Product>
): OrderItemOutput[] {
  return lines.map((line) => toOrderItemFromLine(line, productMap));
}

/**
 * Compute the earliest returns cutoff across all items (if any).
 */
export function earliestReturnsCutoffISO(
  items: OrderItemOutput[]
): string | undefined {
  const timestamps = items
    .map((i) =>
      i.returnsAcceptedThrough ? Date.parse(i.returnsAcceptedThrough) : NaN
    )
    .filter((n) => Number.isFinite(n)) as number[];

  if (timestamps.length === 0) return undefined;
  return new Date(Math.min(...timestamps)).toISOString();
}
