import type { Payload } from 'payload';
import type Stripe from 'stripe';

import { ExpandedLineItem } from '@/modules/checkout/types';
import { posthogServer } from '@/lib/server/posthog-server';
import { decProductStockAtomic } from '@/lib/server/utils';

import type { DecProductStockResult } from '@/lib/server/types';

export const isStringValue = (value: unknown): value is string =>
  typeof value === 'string';

/**
 * Type guard that checks whether `item.product` is a non-empty string.
 *
 * When this returns true, `item` can be treated as having a `product: string` property.
 *
 * @returns True if `item.product` is a non-empty string.
 */

export function itemHasProductId(item: { product?: string }): item is {
  product: string;
} {
  return typeof item.product === 'string' && item.product.length > 0;
}

/**
 * Extracts the product identifier stored in a Stripe Product's metadata for a given line item.
 *
 * Looks up `line.price.product` (expected to be an expanded `Stripe.Product`) and returns `metadata.id`.
 *
 * @param line - An expanded line item whose `price.product` is expected to be a `Stripe.Product`.
 * @returns The `metadata.id` value from the Stripe Product.
 * @throws Error if the product metadata does not contain an `id`.
 */

export function requireStripeProductId(line: ExpandedLineItem): string {
  const stripeProduct = line.price?.product as Stripe.Product | undefined;
  const id = stripeProduct?.metadata?.id;
  if (!id) {
    throw new Error(
      `Missing product id in Stripe product metadata (product.id=${stripeProduct?.id ?? 'unknown'})`
    );
  }
  return id;
}

/**
 * Detects whether an error represents a unique-constraint (duplicate-key) violation.
 *
 * Checks common indicators for MongoDB (error code 11000 or message containing "E11000 duplicate key error")
 * and PostgreSQL (error code '23505' or message containing "duplicate key value", case-insensitive).
 *
 * @param err - The error value to inspect (any object with optional `code` or `message` properties).
 * @returns `true` if the error appears to be a duplicate-key/unique-constraint violation, otherwise `false`.
 */

export function isUniqueViolation(err: unknown): boolean {
  const anyErr = err as { code?: number | string; message?: string };
  if (anyErr?.code === 11000 || anyErr?.code === '23505') return true; // Mongo / Postgres
  if (typeof anyErr?.message === 'string') {
    return (
      anyErr.message.includes('E11000 duplicate key error') || // Mongo message
      anyErr.message.toLowerCase().includes('duplicate key value') // PG message
    );
  }
  return false;
}

export const flushIfNeeded = async () => {
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.NETLIFY;
  if (isServerless || process.env.NODE_ENV !== 'production') {
    await posthogServer?.flush?.();
  }
};

/**
 * Aggregate an array of line items into a map of product ID -> total quantity.
 *
 * Each input item must have a `product` id. If `quantity` is missing or not a number,
 * it defaults to 1. Quantities for the same product id are summed.
 *
 * @param items - Array of objects containing `product` (id) and optional `quantity`
 * @returns A Map where keys are product ids and values are the aggregated quantities
 */

export function toQtyMap(
  items: Array<{ product: string; quantity?: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const qty = typeof item.quantity === 'number' ? item.quantity : 1;
    map.set(item.product, (map.get(item.product) ?? 0) + qty);
  }
  return map;
}

/**
 * Decrements stock quantities for multiple products and archives any that reach zero.
 *
 * For each entry, performs a single atomic decrement at the DB layer via
 * `decProductStockAtomic(payload, productId, qty, { autoArchive: true })`.
 * On success logs `{ after, archived }`. On failure logs a typed `reason`
 * ('not-found' | 'not-tracked' | 'insufficient').
 *
 * @param qtyByProductId - Map from product ID to the quantity to subtract (total purchased quantity).
 */

export async function decrementInventoryBatch(args: {
  payload: Payload;
  qtyByProductId: Map<string, number>;
}): Promise<void> {
  const { payload, qtyByProductId } = args;

  for (const [productId, purchasedQty] of qtyByProductId) {
    const res: DecProductStockResult = await decProductStockAtomic(
      payload,
      productId,
      purchasedQty,
      {
        autoArchive: true
      }
    );

    if (res.ok) {
      // Typed log with post-update values
      console.log('[inv] dec-atomic', {
        productId,
        purchasedQty,
        after: res.after,
        archived: res.archived
      });
      continue;
    }

    // Failure paths are explicit and typed
    console.warn('[inv] dec-atomic failed', {
      productId,
      purchasedQty,
      reason: res.reason
    });

    // Optional: decide your policy here
    // - 'insufficient': you could mark the order for manual review or issue a refund
    // - 'not-tracked': ignore (product doesn’t track inventory)
    // - 'not-found': log / alert
  }
}
