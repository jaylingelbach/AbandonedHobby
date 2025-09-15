import { ExpandedLineItem } from '@/modules/checkout/types';
import type Stripe from 'stripe';
import { posthogServer } from '@/lib/server/posthog-server';
import type { Payload } from 'payload';
import { Product } from '@/payload-types';

console.log('[utils] decrementInventoryBatch loaded');

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
 * Aggregate an array of product line items into a map of total quantities per product ID.
 *
 * Each item must have a `product` ID; `quantity` is optional and defaults to 1 when missing or not a number.
 *
 * @param items - Array of items where each entry specifies a `product` ID and an optional `quantity`.
 * @returns A Map from product ID to the summed quantity for that product.
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
 * Decrement stock quantities for multiple products and archive products that reach zero.
 *
 * For each entry in `qtyByProductId` this function reads the published product document, skips products
 * that do not track inventory, subtracts the purchased quantity (clamped at 0), and updates the
 * published product with the new `stockQuantity`. If the resulting quantity is 0 the product is
 * marked `isArchived: true`.
 *
 * Note: `payload` is used to read and update published product documents with elevated access.
 *
 * @param qtyByProductId - Map from product ID to total quantity to subtract for that product
 */
export async function decrementInventoryBatch(args: {
  payload: Payload;
  qtyByProductId: Map<string, number>;
}): Promise<void> {
  const { payload, qtyByProductId } = args;

  for (const [productId, purchasedQty] of qtyByProductId) {
    // Read the published doc
    const product = (await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
      draft: false
    })) as Product;

    const trackInventory = Boolean(product.trackInventory);
    if (!trackInventory) continue;

    const current =
      typeof product.stockQuantity === 'number' ? product.stockQuantity : 0;
    const nextQty = Math.max(0, current - purchasedQty);

    // Write the published doc
    const updatedProduct = (await payload.update({
      collection: 'products',
      id: productId,
      data: {
        stockQuantity: nextQty,
        ...(nextQty === 0 ? { isArchived: true } : {})
      },
      overrideAccess: true,
      draft: false,
      // optional but nice to have if you keep the bypass in hooks:
      context: { ahSystem: true, ahSkipAutoArchive: true }
    })) as Product;

    // Typed log
    console.log('[inv] updated', {
      productId,
      after: updatedProduct.stockQuantity,
      archived: updatedProduct.isArchived
    });
  }
}
