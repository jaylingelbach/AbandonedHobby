import { TRPCError } from '@trpc/server';
import { getPayload } from 'payload';

import config from '@payload-config';

import { relId, type Relationship } from '@/lib/relationshipHelpers';
import type { Category, Product, Review, Tenant } from '@/payload-types';

import type {
  DecProductStockResult,
  DraftStatus,
  FindOneAndUpdateCapable,
  FindOneAndUpdateReturn,
  HasStartSession,
  IdRef,
  PayloadDbWithConnection,
  UpdateOneCapable
} from './types';
import type { ClientSession } from 'mongoose';
import type { Payload } from 'payload';

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

export function softRelId(ref: IdRef | null | undefined): string | null {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string')
    return ref.id;
  return null;
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

/** Single atomic increment for a tenant’s `productCount`.
 * (Mongo-first; with optional fallback)
 **/
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
      { $inc: { productCount: delta, $max: { productCount: 0 } } },
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

/**
 * Best-effort helper to obtain a low-level "products" collection handle that
 * supports `findOneAndUpdate(...)` from the current Payload DB adapter.
 *
 * Why:
 * - Some operations (e.g., atomic stock decrements using an aggregation pipeline)
 *   require a native collection/model method that Payload’s high-level API
 *   doesn’t expose directly. This function discovers such a handle, if available.
 *
 * How it works:
 * - Navigates through `payload.db.collections.products` and tests common adapter
 *   shapes in order:
 *     1) Mongoose model at `.Model`
 *     2) Native driver collection at `.collection`
 *     3) The wrapper object itself
 * - Returns the first candidate that implements `findOneAndUpdate`.
 *
 * Safety & portability:
 * - Returns `null` when the adapter doesn’t expose a compatible handle. Callers
 *   must handle this case (e.g., by falling back to a non-atomic path).
 * - This inspects internal adapter structures and is not part of Payload’s
 *   public API; future adapter versions may change shapes.
 *
 * @param payload - The initialized Payload instance.
 * @returns A handle implementing `findOneAndUpdate` or `null` if none is found.
 *
 * @example
 * const coll = getProductsCollection(payload);
 * if (!coll) {
 *   // Fallback: adapter doesn’t expose native ops
 *   return { ok: false, reason: 'not-found' };
 * }
 * const res = await coll.findOneAndUpdate(
 *   { _id: productId, stockQuantity: { $gte: qty } },
 *   [{ $set: { stockQuantity: { $subtract: ['$stockQuantity', qty] } } }],
 *   { returnDocument: 'after', new: true }
 * );
 */

export function getProductsCollection(
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

  for (const candidate of candidates) {
    if (
      isObjectRecord(candidate) &&
      typeof (candidate as { findOneAndUpdate?: unknown }).findOneAndUpdate ===
        'function'
    ) {
      return candidate as FindOneAndUpdateCapable;
    }
  }
  return null;
}

/**
 * Atomically decrements a product's `stockQuantity` and (optionally) auto-archives
 * the product when it reaches zero, using the database adapter's native
 * `findOneAndUpdate` with an aggregation pipeline.
 *
 * Concurrency & safety:
 * - The update runs atomically with a filter that requires `trackInventory: true`
 *   and `stockQuantity >= qty`, preventing oversells under concurrent webhooks.
 * - If the adapter cannot expose a native collection with `findOneAndUpdate`,
 *   the function returns `{ ok: false, reason: 'not-found' }` (non-atomic fallback).
 *
 * Behavior:
 * - If `qty <= 0`, no write is performed; the function returns a snapshot
 *   `{ ok: true, after, archived }` of the current product (or `'not-found'`).
 * - On successful decrement, returns `{ ok: true, after, archived }` where:
 *     - `after` is the new `stockQuantity`
 *     - `archived` reflects the current `isArchived` flag
 * - If the decrement cannot be applied, returns `{ ok: false, reason }` with:
 *     - `'not-found'`   → product does not exist (or adapter unsupported)
 *     - `'not-tracked'` → product has `trackInventory !== true`
 *     - `'insufficient'`→ `stockQuantity < qty` at the time of update
 *
 * Auto-archive:
 * - When `opts.autoArchive === true`, `isArchived` is set to `true` if the
 *   post-decrement stock is exactly `0`; otherwise it is left unchanged.
 *
 * @param payload - The initialized Payload instance.
 * @param productId - The `_id` of the product to update.
 * @param qty - The quantity to subtract (must be > 0 to perform a write).
 * @param opts - Optional settings.
 * @param opts.autoArchive - If `true`, archive when stock hits zero (default: `false`).
 * @returns A `DecProductStockResult`:
 *   - `{ ok: true, after, archived }` on success (or snapshot for `qty <= 0`)
 *   - `{ ok: false, reason: 'not-found' | 'not-tracked' | 'insufficient' }` on failure
 *
 * @example
 * const res = await decProductStockAtomic(payload, productId, 2, { autoArchive: true });
 * if (!res.ok) {
 *   switch (res.reason) {
 *     case 'not-found':     // handle missing product / unsupported adapter
 *     case 'not-tracked':   // handle listing that doesn't track inventory
 *     case 'insufficient':  // handle sold-out / not enough stock
 *   }
 * } else {
 *   console.log('New qty:', res.after, 'Archived:', res.archived);
 * }
 */

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

/**
 * Safely extract a draft status from an unknown value containing a `_status` field.
 *
 * @param value - Unknown object that may include `_status`.
 * @returns `'draft' | 'published'` if recognized; otherwise `undefined`.
 */

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

/**
 * Type guard for the adapter return value of `findOneAndUpdate` that normalizes
 * different adapter shapes: some wrap the document in `{ value: ... }`, others
 * return the document directly.
 *
 * @param v - A `FindOneAndUpdateReturn` candidate.
 * @returns True if `v` has a `value` key (wrapping the document).
 */

export function hasValueKey(
  v: FindOneAndUpdateReturn
): v is { value: Record<string, unknown> | null } {
  return !!v && isObjectRecord(v) && 'value' in v;
}

// helper to detect "not found" from Payload errors
export const isNotFound = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const status =
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : undefined;
  const message =
    typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : undefined;
  const code =
    typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : undefined;
  return (
    status === 404 ||
    code === 'PAYLOAD_NOT_FOUND' ||
    (message ? /not found/i.test(message) : false)
  );
};

/**
 * Normalize various thrown error values into a consistent details object.
 *
 * Converts Error instances, strings, numbers, and plain object-like errors into
 * an object containing any of: `message`, `name`, `code`, `status`, `data`, and `errors`.
 * For object-like inputs this preserves existing fields when present; it also
 * recognizes common variants such as `statusCode` and TRPC-style `data.httpStatus`.
 *
 * @param err - The thrown value to normalize (Error, string, number, or object)
 * @returns An object with any of the properties: `message`, `name`, `code` (string|number), `status` (number), `data`, and `errors`
 */
export function extractErrorDetails(err: unknown) {
  const out: {
    message?: string;
    name?: string;
    code?: string | number;
    status?: number;
    data?: unknown;
    errors?: unknown;
  } = {};

  if (err instanceof Error) {
    out.message = err.message;
    out.name = err.name;
  }

  // Support string-thrown errors
  else if (typeof err === 'string') {
    out.message = err;
  }
  // Support number-thrown errors
  else if (typeof err === 'number') {
    out.code = err;
    out.message = String(err);
  }

  if (isObjectRecord(err)) {
    // Preserve any additional fields Payload/TRPC may attach
    if (typeof err.message === 'string') out.message = err.message;
    if (typeof err.name === 'string') out.name = err.name;
    if (
      typeof (err as { code?: unknown }).code === 'string' ||
      typeof (err as { code?: unknown }).code === 'number'
    ) {
      out.code = (err as { code: string | number }).code;
    }
    if (typeof (err as { status?: unknown }).status === 'number') {
      out.status = (err as { status: number }).status;
    }
    // Fall back to `statusCode` and TRPC's `data.httpStatus` if present
    if (
      out.status === undefined &&
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
    ) {
      out.status = (err as { statusCode: number }).statusCode;
    }
    if (out.status === undefined) {
      const dataMaybe = (err as { data?: unknown }).data;
      if (
        isObjectRecord(dataMaybe) &&
        typeof (dataMaybe as { httpStatus?: unknown }).httpStatus === 'number'
      ) {
        out.status = (dataMaybe as { httpStatus: number }).httpStatus;
      }
    }
    if ('data' in err) out.data = err.data as unknown;
    if ('errors' in err) out.errors = err.errors as unknown;
  }

  return out;
}
