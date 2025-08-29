import { TRPCError } from '@trpc/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { Category } from '@/payload-types';

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
  const res = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    where: { slug: { equals: category } }
  });
  const cat = res.docs[0];
  if (!cat) return false;
  return (
    Array.isArray(cat.subcategories) &&
    cat.subcategories.some((s: Category) => s.slug === sub)
  );
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
