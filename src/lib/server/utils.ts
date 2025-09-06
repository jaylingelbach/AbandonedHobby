import { TRPCError } from '@trpc/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { Category, Product, Review } from '@/payload-types';

// Categories
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

// Categories and Subcategories
export async function isValidCategoryAndSub(
  category: string,
  sub: string
): Promise<boolean> {
  if (!category || !sub) return false;
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
    where: {
      slug: { equals: sub },
      parent: { equals: cat.id }
    }
  });
  return subRes.totalDocs > 0;
}

type IdRef = string | { id: string } | null | undefined;

export function asId(ref: IdRef): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string')
    return ref.id;

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Missing or invalid tenant reference.'
  });
}

export function daysForPolicy(p?: string): number {
  switch (p) {
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

/** Safely extract a product id from a relationship that may be string or doc */
export function getRelId(
  rel: string | Product | null | undefined
): string | null {
  if (typeof rel === 'string' && rel) return rel;
  if (
    rel &&
    typeof rel === 'object' &&
    'id' in rel &&
    typeof rel.id === 'string'
  ) {
    return rel.id;
  }
  return null;
}

export function summarizeReviews(
  reviews: Review[]
): Map<string, { count: number; avg: number }> {
  const sums = new Map<string, { count: number; sum: number }>();

  for (const review of reviews) {
    const productId = getRelId(review.id);

    if (!productId) continue;

    const rating = typeof review.rating === 'number' ? review.rating : 0;
    const current = sums.get(productId) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += rating;
    sums.set(productId, current);
  }

  const out = new Map<string, { count: number; avg: number }>();
  for (const [pid, { count, sum }] of sums.entries()) {
    out.set(pid, {
      count,
      avg: count ? Math.round((sum / count) * 10) / 10 : 0
    });
  }
  return out;
}
