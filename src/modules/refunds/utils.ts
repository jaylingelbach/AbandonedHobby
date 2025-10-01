import type Stripe from 'stripe';
import { OrderItem } from '../library/ui/components/types';
import { assertPositiveInt } from '../orders/utils';
import {
  EngineOptions,
  LineSelection,
  LocalRefundStatus,
  OrderLike,
  StripeRefundReason
} from './types';
import crypto from 'node:crypto';

export function toMapById(items: OrderItem[]): Map<string, OrderItem> {
  const newMap = new Map<string, OrderItem>();
  for (const item of items) {
    if (typeof item.id === 'string' && item.id) newMap.set(item.id, item);
  }
  return newMap;
}

export function buildIdempotencyKey(
  orderId: string,
  selections: LineSelection[],
  options?: EngineOptions
): string {
  const payload = JSON.stringify({ orderId, selections, options });
  return crypto
    .createHash('sha256')
    .update(`refund:v1:${payload}`)
    .digest('hex');
}

export function computeRefundAmountCents(
  order: OrderLike,
  selections: LineSelection[]
): number {
  const items = Array.isArray(order.items) ? order.items : [];
  const byId = toMapById(items);

  let sum = 0;

  for (const sel of selections) {
    const src = byId.get(sel.itemId);
    if (!src) throw new Error(`Item not found: ${sel.itemId}`);
    const originalQty = assertPositiveInt(src.quantity ?? 1, 'item.quantity');
    const unitBase =
      typeof src.unitAmount === 'number'
        ? src.unitAmount
        : Math.round((src.amountTotal ?? 0) / originalQty);
    // Prefer true per-line totals if present (includes discounts/taxes)
    const lineTotal =
      typeof src.amountTotal === 'number'
        ? src.amountTotal
        : unitBase * originalQty;

    const perUnitTotal = Math.round(lineTotal / originalQty);
    const qtySelected = assertPositiveInt(sel.quantity, 'selection.quantity');
    if (qtySelected > originalQty) {
      throw new Error(
        `selection.quantity exceeds purchased quantity for item ${sel.itemId}`
      );
    }
    sum += perUnitTotal * qtySelected;
  }
  return sum;
}

export function toStripeRefundReason(
  reason?: StripeRefundReason
): Stripe.RefundCreateParams.Reason | undefined {
  if (
    reason === 'requested_by_customer' ||
    reason === 'duplicate' ||
    reason === 'fraudulent'
  ) {
    return reason;
  }
  return undefined; // 'other' (and any unknown) not allowed by Stripe
}

export function toLocalRefundStatus(status: string | null): LocalRefundStatus {
  switch (status) {
    case 'succeeded':
    case 'pending':
    case 'failed':
    case 'canceled':
      return status;
    default:
      return 'pending'; // safe default for unexpected/temporary values
  }
}
