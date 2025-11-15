// ─── Type-only Imports ───────────────────────────────────────────────────────
import { posthogServer } from '@/lib/server/posthog-server';
import type { DecProductStockResult } from '@/lib/server/types';
import { decProductStockAtomic } from '@/lib/server/utils';
import { ExpandedLineItem } from '@/modules/checkout/types';

import type { Payload } from 'payload';
import type Stripe from 'stripe';
import type { PayloadMongoLike, ProductModelLite, FeeResult } from './types';

// ─── Project Imports ─────────────────────────────────────────────────────────

import { ExistingOrderPrecheck } from './types';
import { parseQuantity, Quantity } from '@/lib/validation/quantity';

// Helpers

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
  items: Array<{ product: string; quantity: Quantity | unknown }>
): Map<string, Quantity> {
  const map = new Map<string, Quantity>();
  for (const item of items) {
    const quantity = parseQuantity(item.quantity);
    const existing = map.get(item.product) ?? 0;
    map.set(item.product, (existing + quantity) as Quantity);
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
  qtyByProductId: Map<string, Quantity>;
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

export async function tryCall<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[WEBHOOK ERROR @ ${label}]`, err);
    if (err instanceof Error && err.stack) {
      console.error(`[WEBHOOK ERROR stack @ ${label}]`, err.stack);
    }
    throw err;
  }
}

export function getProductsModel(
  payload: import('payload').Payload
): ProductModelLite | null {
  const maybeDb = (payload as unknown as PayloadMongoLike).db;
  const collections = maybeDb?.collections;
  const productsUnknown = collections?.products as unknown;

  const maybeModel =
    productsUnknown &&
    ((productsUnknown as { Model?: unknown }).Model as unknown);
  const model = maybeModel as Partial<ProductModelLite> | undefined;

  if (
    model &&
    typeof model.findOneAndUpdate === 'function' &&
    typeof model.updateOne === 'function'
  ) {
    return model as ProductModelLite;
  }
  return null;
}

export async function findExistingOrderBySessionOrEvent(
  payload: Payload,
  sessionId: string,
  eventId: string
): Promise<ExistingOrderPrecheck | null> {
  const result = await payload.find({
    collection: 'orders',
    where: {
      or: [
        { stripeCheckoutSessionId: { equals: sessionId } },
        { stripeEventId: { equals: eventId } }
      ]
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      items: true,
      amounts: true,
      documents: true,
      inventoryAdjustedAt: true,
      stripePaymentIntentId: true,
      stripeChargeId: true
    }
  });

  if (result.totalDocs === 0) return null;

  const raw = result.docs[0] as unknown;

  // Helpers that preserve explicit 0 and reject non-finite numbers
  const toOptionalInt = (value: unknown): number | null => {
    if (value == null) return null;
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? Math.trunc(asNumber) : null;
  };

  // Normalize amounts: keep explicit 0; coerce NaN/Infinity -> null
  const amountsRaw =
    (
      raw as {
        amounts?: {
          platformFeeCents?: unknown;
          stripeFeeCents?: unknown;
        } | null;
      }
    ).amounts ?? null;

  const amounts =
    amountsRaw && typeof amountsRaw === 'object'
      ? {
          platformFeeCents: toOptionalInt(
            (amountsRaw as { platformFeeCents?: unknown }).platformFeeCents
          ),
          stripeFeeCents: toOptionalInt(
            (amountsRaw as { stripeFeeCents?: unknown }).stripeFeeCents
          )
        }
      : null;

  // Normalize documents: ensure receiptUrl is string|null when object exists
  const documentsRaw =
    (raw as { documents?: { receiptUrl?: unknown } | null }).documents ?? null;

  const documents =
    documentsRaw && typeof documentsRaw === 'object'
      ? {
          receiptUrl:
            typeof (documentsRaw as { receiptUrl?: unknown }).receiptUrl ===
            'string'
              ? ((documentsRaw as { receiptUrl?: unknown })
                  .receiptUrl as string)
              : null
        }
      : null;

  const normalized: ExistingOrderPrecheck = {
    id: String((raw as { id?: unknown }).id),
    items: Array.isArray((raw as { items?: unknown }).items)
      ? (
          raw as {
            items: Array<{
              product?: unknown;
              quantity?: unknown;
            }>;
          }
        ).items.map((item) => ({
          // Preserve either a string id, a relationship object (with optional id),
          // or null — caller will handle narrowing.
          product:
            typeof item.product === 'string' || item.product == null
              ? (item.product as string | null)
              : typeof item.product === 'object'
                ? (item.product as { id?: string | null })
                : null,
          quantity:
            typeof item.quantity === 'number' && Number.isInteger(item.quantity)
              ? (item.quantity as number)
              : null
        }))
      : null,
    amounts,
    documents,
    inventoryAdjustedAt:
      (raw as { inventoryAdjustedAt?: unknown }).inventoryAdjustedAt == null
        ? null
        : String(
            (raw as { inventoryAdjustedAt?: unknown }).inventoryAdjustedAt
          ),
    stripePaymentIntentId:
      (raw as { stripePaymentIntentId?: unknown }).stripePaymentIntentId == null
        ? null
        : String(
            (raw as { stripePaymentIntentId?: unknown }).stripePaymentIntentId
          ),
    stripeChargeId:
      (raw as { stripeChargeId?: unknown }).stripeChargeId == null
        ? null
        : String((raw as { stripeChargeId?: unknown }).stripeChargeId)
  };

  return normalized;
}

/** Compute fees directly from an expanded charge (preferred). */
export function computeFeesFromCharge(charge: Stripe.Charge): FeeResult {
  const balanceTransaction =
    charge.balance_transaction as Stripe.BalanceTransaction | null;

  const applicationFeeCents =
    typeof charge.application_fee_amount === 'number'
      ? charge.application_fee_amount
      : 0;

  let processingFeeCents = 0;

  // Prefer fee_details if present (most accurate)
  const details =
    balanceTransaction && Array.isArray(balanceTransaction.fee_details)
      ? balanceTransaction.fee_details
      : null;

  if (details) {
    // Sum everything that is NOT the application fee
    processingFeeCents = details
      .filter((d) => d.type !== 'application_fee')
      .reduce(
        (sum, d) => sum + (typeof d.amount === 'number' ? d.amount : 0),
        0
      );
  } else {
    const totalFee =
      typeof balanceTransaction?.fee === 'number' ? balanceTransaction.fee : 0;
    processingFeeCents = Math.max(0, totalFee - applicationFeeCents);
  }

  const receiptUrl =
    typeof charge.receipt_url === 'string' ? charge.receipt_url : null;

  return {
    stripeFeeCents: processingFeeCents,
    platformFeeCents: applicationFeeCents,
    receiptUrl
  };
}

/**
 * Parse Stripe metadata to extract common fields used across webhook handlers.
 *
 * @param metadata - The metadata object from a Stripe resource (session, payment intent, etc.)
 * @returns Parsed metadata with buyerId, tenantId, tenantSlug, and deduplicated productIds array
 */
export function parseStripeMetadata(
  metadata: Record<string, string> | null | undefined
): {
  buyerId: string;
  tenantId?: string;
  tenantSlug?: string;
  productIds?: string[];
} {
  const meta = (metadata ?? {}) as Record<string, string>;
  const buyerId = meta.userId ?? meta.buyerId ?? 'anonymous';
  const tenantId = meta.tenantId;
  const tenantSlug = meta.tenantSlug;

  const productIds =
    typeof meta.productIds === 'string' && meta.productIds.length
      ? meta.productIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((id, index, self) => self.indexOf(id) === index)
      : undefined;

  return { buyerId, tenantId, tenantSlug, productIds };
}
