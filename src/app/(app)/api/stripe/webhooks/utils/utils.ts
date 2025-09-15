import { ExpandedLineItem } from '@/modules/checkout/types';
import type Stripe from 'stripe';
import { posthogServer } from '@/lib/server/posthog-server';

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
