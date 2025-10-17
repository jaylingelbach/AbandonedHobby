import Stripe from 'stripe';

import type { ExpandedLineItem } from './guards';

export function sumAmountTotalCents(lines: Stripe.LineItem[]): number {
  return lines.reduce((sum, line) => {
    const qty = typeof line.quantity === 'number' ? line.quantity : 1;
    const lineTotal =
      typeof line.amount_total === 'number'
        ? line.amount_total
        : (line.price?.unit_amount ?? 0) * qty;
    return sum + lineTotal;
  }, 0);
}

export function buildReceiptLineItems(lines: ExpandedLineItem[]) {
  return lines.map((line) => {
    const product = line.price.product;
    const description = product?.name ?? line.description ?? 'Item';
    const qty = typeof line.quantity === 'number' ? line.quantity : 1;
    const amount =
      typeof line.amount_total === 'number'
        ? line.amount_total
        : (line.price.unit_amount ?? 0) * qty;

    return {
      description,
      amount: `$${(amount / 100).toFixed(2)}`
    };
  });
}
