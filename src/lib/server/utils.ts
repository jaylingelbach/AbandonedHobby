import { TRPCError } from '@trpc/server';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import type { ClientSession } from 'mongoose';

import config from '@payload-config';
import type { Category, Product, Review, Tenant } from '@/payload-types';
import { relId, type Relationship } from '@/lib/relationshipHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Basic guards & relationship coercion
// ─────────────────────────────────────────────────────────────────────────────

/** Backwards-compatability: extract an id from string | {id} | null/undefined. */
export function getRelId<T extends { id: string }>(
  rel: string | T | Relationship<T> | null | undefined
): string | null {
  // Reuse the single source of truth
  const id = relId(rel as Relationship<T>);
  return id ?? null;
}

/** Type guard: true if `value` is a non-null object (record-like). */
export function isObjectRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard: true if `value` is an object with a string `id` property. */
export function hasStringId(value: unknown): value is { id: string } {
  return (
    isObjectRecord(value) && typeof value.id === 'string' && value.id.length > 0
  );
}

/** Convert unknown into a Payload-style Relationship<T> (string id or {id}) or return undefined. */
export function toRelationship<T extends { id: string }>(
  value: unknown
): Relationship<T> {
  if (typeof value === 'string') return value as Relationship<T>;
  if (hasStringId(value)) return value as T;
  return undefined;
}

/** Payload-style relationship reference: string id or { id }, optionally null/undefined. */
type IdRef = string | { id: string } | null | undefined;

/** Normalize a relationship ref to a string id; throws TRPC BAD_REQUEST if missing/invalid. */
export function asId(ref: IdRef): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string')
    return ref.id;

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Missing or invalid tenant reference.'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Category utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if a category slug exists. */
export async function isValidCategory(slug: string): Promise<boolean> {
  if (!slug) return false;
  const payload = await getPayload({ config });
  const res = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } }
  });
  return res.totalDocs > 0;
}

/** Returns true if `subcategory` exists under `category` (by slug). */
export async function isValidCategoryAndSub(
  category: string,
  subcategory: string
): Promise<boolean> {
  if (!category || !subcategory) return false;

  const payload = await getPayload({ config });

  const catRes = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    where: { slug: { equals: category } }
  });
  const cat = catRes.docs[0] as Category | undefined;
  if (!cat?.id) return false;

  const subRes = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    where: { slug: { equals: subcategory }, parent: { equals: cat.id } }
  });

  return subRes.totalDocs > 0;
}

/** Extract the Category id from Payload’s siblingData.category relationship (string or {id}). */
export function getCategoryIdFromSibling(
  siblingData: unknown
): string | undefined {
  if (!isObjectRecord(siblingData)) return undefined;
  const raw = (siblingData as { category?: unknown }).category;
  return relId(toRelationship<Category>(raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Refund policy label → number of days. */
export function daysForPolicy(policy?: Product['refundPolicy']): number {
  switch (policy) {
    case '30 day':
      return 30;
    case '14 day':
      return 14;
    case '7 day':
      return 7;
    case '1 day':
      return 1;
    default:
      return 0; // 'no refunds' or undefined
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Review aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Summarize reviews by product id:
 * returns Map<productId, { count, avg }>
 */
export function summarizeReviews(
  reviews: Review[]
): Map<string, { count: number; avg: number }> {
  const totals = new Map<string, { count: number; sum: number }>();

  for (const review of reviews) {
    // Expect Review to have a `product` relationship (string | {id} | null)
    const productRel = (review as { product?: unknown }).product;
    const productId = relId(productRel as Relationship<Product>);
    if (!productId) continue;

    if (typeof review.rating !== 'number' || Number.isNaN(review.rating)) {
      continue;
    }
    const rating = Math.max(0, Math.min(5, review.rating));
    const current = totals.get(productId) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += rating;
    totals.set(productId, current);
  }

  const result = new Map<string, { count: number; avg: number }>();
  for (const [productId, { count, sum }] of totals.entries()) {
    result.set(productId, {
      count,
      avg: count ? Math.round((sum / count) * 10) / 10 : 0
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mongo atomic counter utilities (Payload mongooseAdapter)
// ─────────────────────────────────────────────────────────────────────────────
type PayloadDbWithConnection = {
  connection: { startSession: () => Promise<ClientSession> };
};

/** Internal: get the Tenants collection handle from Payload's db. */
type UpdateOneCapable = {
  updateOne: (
    filter: Record<string, unknown>,
    // allow both classic update docs and aggregation pipeline updates
    update: Record<string, unknown> | Record<string, unknown>[], // or: | PipelineStage[]
    options?: { session?: ClientSession }
  ) => Promise<unknown>;
};

function hasUpdateOne(v: unknown): v is UpdateOneCapable {
  return isObjectRecord(v) && typeof v.updateOne === 'function';
}

/** Find a handle with `updateOne` for the Tenants collection across possible adapter shapes. */
function getTenantsCollection(
  payload: import('payload').Payload
): UpdateOneCapable | null {
  const db = (payload as { db?: unknown }).db;
  if (!isObjectRecord(db)) return null;

  const collections = (db as { collections?: unknown }).collections;
  if (!isObjectRecord(collections)) return null;

  const tenants = (collections as Record<string, unknown>).tenants;
  if (!tenants) return null;

  const candidates: unknown[] = [
    (tenants as { Model?: unknown }).Model, // mongoose model
    (tenants as { collection?: unknown }).collection, // native driver collection
    tenants // wrapper
  ];

  for (const candidate of candidates) {
    if (hasUpdateOne(candidate)) return candidate;
  }
  return null;
}

/** Internal: start a mongoose session if supported by the current adapter. */
type HasStartSession = {
  startSession: () => Promise<ClientSession>;
};

function hasStartSession(value: unknown): value is HasStartSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startSession' in value &&
    typeof (value as { startSession?: unknown }).startSession === 'function'
  );
}

/** Internal: start a mongoose session if supported by the current adapter  */
async function startSessionIfSupported(
  payload: Payload
): Promise<ClientSession | null> {
  const db = (payload as { db?: unknown }).db;
  if (!db || typeof db !== 'object') return null;

  const connection = (db as PayloadDbWithConnection).connection;
  return hasStartSession(connection) ? connection.startSession() : null;
}

// Recompute productCount from source of truth and write it to the tenant.
// Uses find({ limit: 0 }) and totalDocs to avoid fetching docs. --only runs if mongo handler not available
export async function recountTenantProductCount(
  payload: Payload,
  tenantId: string
): Promise<number> {
  const res = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 0,
    where: { tenant: { equals: tenantId } }
  });

  const count = typeof res.totalDocs === 'number' ? res.totalDocs : 0;

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { productCount: count }
  });

  return count;
}

/** Single atomic increment for a tenant’s `productCount`. (Mongo-first; with optional fallback) */
// drop-in replacement for incTenantProductCount
export async function incTenantProductCount(
  payload: Payload,
  tenantId: string,
  delta: number,
  session?: ClientSession
): Promise<void> {
  if (!delta) return;

  const handle = getTenantsCollection(payload);
  if (!handle) {
    if (process.env.AH_RECOUNT_FALLBACK === 'true') {
      if (process.env.NODE_ENV === 'production') {
        console.info(
          `[incTenantProductCount] Using recount fallback for tenant ${tenantId}`
        );
      }
      await recountTenantProductCount(payload, tenantId);
    }
    return;
  }

  const options = session ? { session } : undefined;

  // Pipeline update: productCount = max( ifNull(productCount,0) + delta, 0 )
  const pipeline: Record<string, unknown>[] = [
    {
      $set: {
        productCount: {
          $max: [{ $add: [{ $ifNull: ['$productCount', 0] }, delta] }, 0]
        }
      }
    }
  ];

  try {
    await handle.updateOne({ _id: tenantId }, pipeline, options);
  } catch {
    // Fallback if the adapter/version doesn't support pipeline updates
    await handle.updateOne(
      { _id: tenantId },
      { $inc: { productCount: delta } },
      options
    );
  }
}

/** Atomically do -1 on previous and +1 on next in a transaction (swap). */
/**
 * Atomically swap product-counts between two tenants by decrementing the previous tenant and incrementing the next.
 *
 * If `previousTenantId` and `nextTenantId` are equal the function returns immediately. When the Payload database
 * supports MongoDB sessions this runs both increments inside a transaction so the two updates are applied atomically.
 * If sessions are not supported, behavior depends on the AH_RECOUNT_FALLBACK environment variable:
 * - If AH_RECOUNT_FALLBACK === 'true', performs full recounts for the affected tenants to avoid drifting counts.
 * - Otherwise, no updates are performed and a warning is emitted in non-production environments.
 *
 * @param previousTenantId - ID of the tenant to decrement (may be an empty string to skip).
 * @param nextTenantId - ID of the tenant to increment (may be an empty string to skip).
 * @returns A promise that resolves when the operation completes.
 */

export async function swapTenantCountsAtomic(
  payload: Payload,
  previousTenantId: string,
  nextTenantId: string
): Promise<void> {
  if (previousTenantId === nextTenantId) return;

  const session = await startSessionIfSupported(payload);
  if (session) {
    await session.withTransaction(async () => {
      await incTenantProductCount(payload, previousTenantId, -1, session);
      await incTenantProductCount(payload, nextTenantId, +1, session);
    });
    await session.endSession();
    return;
  }

  // Non-mongo path: prefer full recounts to avoid drift under concurrency.
  if (process.env.AH_RECOUNT_FALLBACK === 'true') {
    if (previousTenantId)
      await recountTenantProductCount(payload, previousTenantId);
    if (nextTenantId) await recountTenantProductCount(payload, nextTenantId);
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[swapTenantCountsAtomic] No mongo transaction; recount fallback disabled. Counts may drift.'
      );
    }
  }
}

/**
 * Type guard that validates an object has tenant Stripe-related fields with expected types.
 *
 * Checks that `value` is a plain object and that:
 * - `stripeAccountId` is `string`, `null`, or `undefined`
 * - `stripeDetailsSubmitted` is `boolean`, `null`, or `undefined`
 *
 * @param value - Value to test
 * @returns `true` if `value` can be treated as `Pick<Tenant, 'stripeAccountId' | 'stripeDetailsSubmitted'>`; otherwise `false`
 */

export function isTenantWithStripeFields(
  value: unknown
): value is Pick<Tenant, 'stripeAccountId' | 'stripeDetailsSubmitted'> {
  if (!isObjectRecord(value)) return false;

  const stripeAccountId = (value as Record<string, unknown>).stripeAccountId;
  const stripeDetailsSubmitted = (value as Record<string, unknown>)
    .stripeDetailsSubmitted;

  const okId =
    stripeAccountId === null ||
    stripeAccountId === undefined ||
    typeof stripeAccountId === 'string';

  const okSubmitted =
    stripeDetailsSubmitted === null ||
    stripeDetailsSubmitted === undefined ||
    typeof stripeDetailsSubmitted === 'boolean';

  return okId && okSubmitted;
}

type FindOneAndUpdateReturn =
  | Record<string, unknown>
  | { value: Record<string, unknown> | null }
  | null;

type FindOneAndUpdateCapable = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown> | Record<string, unknown>[],
    options: Record<string, unknown>
  ) => Promise<FindOneAndUpdateReturn>;
};

function getProductsCollection(
  payload: Payload
): FindOneAndUpdateCapable | null {
  const db = (payload as { db?: unknown }).db;
  if (!isObjectRecord(db)) return null;
  const collections = (db as { collections?: unknown }).collections;
  if (!isObjectRecord(collections)) return null;

  const products = (collections as Record<string, unknown>).products;
  if (!products) return null;

  // Try common shapes: mongoose model (.Model), native collection (.collection), or wrapper itself
  const candidates: unknown[] = [
    (products as { Model?: unknown }).Model,
    (products as { collection?: unknown }).collection,
    products
  ];

  for (const c of candidates) {
    if (
      isObjectRecord(c) &&
      typeof (c as { findOneAndUpdate?: unknown }).findOneAndUpdate ===
        'function'
    ) {
      return c as FindOneAndUpdateCapable;
    }
  }
  return null;
}

export type DecProductStockResult =
  | { ok: true; after: number; archived: boolean }
  | { ok: false; reason: 'not-found' | 'not-tracked' | 'insufficient' };

export async function decProductStockAtomic(
  payload: Payload,
  productId: string,
  qty: number,
  opts: { autoArchive?: boolean } = {}
): Promise<DecProductStockResult> {
  if (qty <= 0) {
    try {
      const peek = (await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 0,
        overrideAccess: true,
        draft: false
      })) as Product | null;

      if (!peek) return { ok: false, reason: 'not-found' };

      const after =
        typeof peek.stockQuantity === 'number' ? peek.stockQuantity : 0;
      const archived = Boolean(peek.isArchived === true);
      return { ok: true, after, archived };
    } catch {
      return { ok: false, reason: 'not-found' };
    }
  }

  const handle = getProductsCollection(payload);
  if (!handle) {
    // Fallback: adapter doesn’t expose native ops
    return { ok: false, reason: 'not-found' };
  }

  // We require `trackInventory: true` and `stockQuantity >= qty` to avoid overselling.
  const filter: Record<string, unknown> = {
    _id: productId,
    trackInventory: true,
    stockQuantity: { $gte: qty }
  };

  // Aggregation pipeline update to compute new qty and optional auto-archive.
  const setStage: Record<string, unknown> = {
    $set: { stockQuantity: { $subtract: ['$stockQuantity', qty] } }
  };

  if (opts.autoArchive) {
    (setStage.$set as Record<string, unknown>).isArchived = {
      $cond: [
        { $eq: [{ $subtract: ['$stockQuantity', qty] }, 0] },
        true,
        '$isArchived'
      ]
    };
  }

  const update: Record<string, unknown>[] = [setStage];

  const raw = await handle.findOneAndUpdate(filter, update, {
    returnDocument: 'after',
    new: true
  });

  const updated: Record<string, unknown> | null = hasValueKey(raw)
    ? raw.value
    : raw;

  if (!updated) {
    // Distinguish reason with a safe high-level read.
    try {
      const peek = (await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 0,
        overrideAccess: true,
        draft: false
      })) as Product | null;

      if (!peek) return { ok: false, reason: 'not-found' };
      const tracked = peek.trackInventory === true;
      if (!tracked) return { ok: false, reason: 'not-tracked' };
      return { ok: false, reason: 'insufficient' };
    } catch {
      return { ok: false, reason: 'not-found' };
    }
  }

  const afterRaw = (updated as { stockQuantity?: unknown }).stockQuantity;
  const after = typeof afterRaw === 'number' ? afterRaw : 0;
  const archived = Boolean(
    (updated as { isArchived?: unknown }).isArchived === true
  );

  return { ok: true, after, archived };
}

export type DraftStatus = 'draft' | 'published';

export function getDraftStatus(value: unknown): DraftStatus | undefined {
  if (
    isObjectRecord(value) &&
    typeof (value as { _status?: unknown })._status === 'string'
  ) {
    const s = (value as { _status?: string })._status;
    if (s === 'draft' || s === 'published') return s;
  }
  return undefined;
}

export function hasValueKey(
  v: FindOneAndUpdateReturn
): v is { value: Record<string, unknown> | null } {
  return !!v && isObjectRecord(v) && 'value' in v;
}
