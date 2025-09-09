import { TRPCError } from '@trpc/server';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import type { ClientSession } from 'mongoose';

import config from '@payload-config';
import type { Category, Product, Review } from '@/payload-types';
import { relId, type Relationship } from '@/lib/relationshipHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Basic guards & relationship coercion
// ─────────────────────────────────────────────────────────────────────────────

/** Back-compat: extract an id from string | {id} | null/undefined. */
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
  return typeof value === 'object' && value !== null;
}

/** Type guard: true if `value` is an object with a string `id` property. */
export function hasStringId(value: unknown): value is { id: string } {
  return isObjectRecord(value) && typeof value.id === 'string';
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
  return relId(toRelationship<{ id: string }>(raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Refund policy label → number of days. */
export function daysForPolicy(policy?: string): number {
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

    const rating = typeof review.rating === 'number' ? review.rating : 0;
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

type TenantsCollection = {
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { session?: ClientSession }
  ) => Promise<unknown>;
};

type PayloadDbWithCollections = {
  collections: { tenants: TenantsCollection };
};

type PayloadDbWithConnection = {
  connection: { startSession: () => Promise<ClientSession> };
};

/** Internal: get the Tenants collection handle from Payload's db. */
function getTenantsCollection(payload: Payload): TenantsCollection | null {
  const db = payload.db as unknown;
  if (
    isObjectRecord(db) &&
    'collections' in db &&
    isObjectRecord((db as { collections: unknown }).collections) &&
    'tenants' in (db as { collections: Record<string, unknown> }).collections
  ) {
    return (db as PayloadDbWithCollections).collections.tenants;
  }
  return null;
}

/** Internal: start a mongoose session if supported by the current adapter. */
async function startSessionIfSupported(
  payload: Payload
): Promise<ClientSession | null> {
  const db = payload.db as unknown;
  if (isObjectRecord(db) && 'connection' in db) {
    const connection = (db as PayloadDbWithConnection).connection;
    return connection.startSession();
  }
  return null;
}

/** Single atomic increment for a tenant’s `productCount`. (Mongo-only) */
export async function incTenantProductCount(
  payload: Payload,
  tenantId: string,
  delta: number,
  session?: ClientSession
): Promise<void> {
  const tenants = getTenantsCollection(payload);
  if (!tenants) return; // non-mongo adapter; no-op
  await tenants.updateOne(
    { _id: tenantId },
    { $inc: { productCount: delta } },
    session ? { session } : undefined
  );
}

/** Atomically do -1 on previous and +1 on next in a transaction (swap). */
export async function swapTenantCountsAtomic(
  payload: Payload,
  previousTenantId: string,
  nextTenantId: string
): Promise<void> {
  if (previousTenantId === nextTenantId) return;

  const session = await startSessionIfSupported(payload);
  if (!session) {
    // Fallback for non-mongo adapters: two best-effort atomic increments
    await incTenantProductCount(payload, previousTenantId, -1);
    await incTenantProductCount(payload, nextTenantId, +1);
    return;
  }

  try {
    await session.withTransaction(async () => {
      await incTenantProductCount(payload, previousTenantId, -1, session);
      await incTenantProductCount(payload, nextTenantId, +1, session);
    });
  } finally {
    await session.endSession();
  }
}
