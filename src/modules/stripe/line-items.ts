import Stripe from 'stripe';

import type { ExpandedLineItem } from './guards';

function computeLineTotal(line: {
  quantity?: number | null;
  amount_total?: number | null;
  price: { unit_amount?: number | null };
}): number {
  const qty = typeof line.quantity === 'number' ? line.quantity : 1;
  return typeof line.amount_total === 'number'
    ? line.amount_total
    : (line.price.unit_amount ?? 0) * qty;
}

/**
 * Compute the total charged amount (in integer cents) across a set of Stripe line items.
 *
 * This function prefers Stripe's authoritative `amount_total` present on each line item.
 * If `amount_total` is absent, it falls back to `price.unit_amount * quantity`.
 *
 * Notes:
 * - All returned values are integer cents.
 * - `quantity` defaults to 1 if missing or invalid.
 * - `unit_amount` defaults to 0 when missing.
 * - This function does not apply additional taxes/discounts beyond what's represented
 *   in the given line items—ensure the `lines` array reflects the final state from Stripe.
 *
 * @param lines - Array of Stripe line items to sum.
 * @returns The sum of all line totals in integer cents.
 *
 * @example
 * ```ts
 * const totalCents = sumAmountTotalCents(checkoutSessionLineItems.data);
 * console.log(totalCents); // e.g., 1299 (=$12.99)
 * ```
 */
export function sumAmountTotalCents(lines: Stripe.LineItem[]): number {
  return lines.reduce((sum, line) => {
    if (!line.price) return sum;
    return (
      sum +
      computeLineTotal(
        line as {
          quantity?: number | null;
          amount_total?: number | null;
          price: { unit_amount?: number | null };
        }
      )
    );
  }, 0);
}

/**
 * Transform expanded Stripe line items into a minimal receipt-friendly shape.
 *
 * Each output row contains a human-readable `description` and a USD-formatted `amount`
 * derived from Stripe's `amount_total` (preferred) or `price.unit_amount * quantity`
 * when `amount_total` is not present. The amount is rendered as a string in dollars
 * (e.g., `"$12.99"`), suitable for display in emails or UI receipts.
 *
 * Notes:
 * - Currency formatting assumes USD; if you support multiple currencies, either:
 *   1) pass currency-aware line items and extend this function to format per-line, or
 *   2) format amounts at the call site using your existing currency utilities.
 * - `quantity` defaults to 1 if missing; `unit_amount` defaults to 0 if missing.
 * - `description` prefers `product.name`, then falls back to `line.description`, then `"Item"`.
 *
 * @param lines - Expanded Stripe line items (with `price.product` populated) to display.
 * @returns An array of `{ description: string; amount: string }` entries.
 *
 * @example
 * ```ts
 * const receiptRows = buildReceiptLineItems(expandedLines);
 * // [{ description: "Widget A", amount: "$12.99" }, ...]
 * ```
 */
export function buildReceiptLineItems(lines: ExpandedLineItem[]) {
  return lines.map((line) => {
    const product = line.price.product;
    const description = product?.name ?? line.description ?? 'Item';
    const amount = computeLineTotal(line);

    return {
      description,
      amount: `$${(amount / 100).toFixed(2)}`
    };
  });
}
