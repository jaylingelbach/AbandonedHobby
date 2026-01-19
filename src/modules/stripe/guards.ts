import Stripe from 'stripe';

import type { Payload } from 'payload';
import { isUniqueViolation } from '@/lib/server/errors/errors';

/**
 * A Checkout line item where price.product is expanded and has metadata.
 */
export type ExpandedLineItem = Stripe.LineItem & {
  price: Stripe.Price & {
    product: Stripe.Product & { metadata: Record<string, string> };
  };
};

export function isExpandedLineItem(
  li: Stripe.LineItem
): li is ExpandedLineItem {
  const price = li.price as Stripe.Price | null | undefined;
  const product = price?.product as Stripe.Product | null | undefined;
  return (
    !!price &&
    !!product &&
    !!product.metadata &&
    typeof product.metadata.id === 'string'
  );
}

export function requireStripeProductIdFromLine(line: ExpandedLineItem): string {
  // use bracket indexing so TS can narrow when noUncheckedIndexedAccess is on
  const metadata = (line.price.product as Stripe.Product).metadata as Record<
    string,
    string
  >;
  const id = metadata['id'];
  if (typeof id !== 'string' || id.trim().length === 0) {
    const prodId = (line.price.product as Stripe.Product).id;
    throw new Error(
      `Missing Stripe Product metadata.id (product.id=${prodId})`
    );
  }
  return id;
}

export function requireStripeProductId(line: ExpandedLineItem): string {
  const prod = line.price.product as Stripe.Product;
  const id = (prod.metadata as Record<string, string>).id;
  if (!id) {
    throw new Error(
      `Missing product id in Stripe product metadata (product.id=${prod.id})`
    );
  }
  return id;
}

export function isStringValue(v: unknown): v is string {
  return typeof v === 'string';
}

export function itemHasProductId(item: {
  product?: string;
}): item is { product: string } {
  return typeof item.product === 'string' && item.product.length > 0;
}

export async function hasProcessed(
  payload: Payload,
  eventId: string
): Promise<boolean> {
  const res = await payload.find({
    collection: 'stripe_events',
    where: { eventId: { equals: eventId } },
    limit: 1,
    depth: 0,
    overrideAccess: true
  });
  return res.totalDocs > 0;
}

/**
 * Record that a Stripe event has been processed by creating a `stripe_events` document.
 *
 * Attempts to create a document with the given `eventId`; if a concurrent unique-constraint
 * violation indicates the event was already recorded, the function returns silently.
 *
 * @param eventId - The Stripe event ID to mark as processed
 */
export async function markProcessed(
  payload: Payload,
  eventId: string
): Promise<void> {
  try {
    await payload.create({
      collection: 'stripe_events',
      data: { eventId },
      overrideAccess: true
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // another concurrent request already recorded this event — that’s fine
      return;
    }
    throw err;
  }
}
