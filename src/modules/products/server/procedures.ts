import { TRPCError } from '@trpc/server';
import { headers as getHeaders } from 'next/headers';
import { z } from 'zod';

import { DEFAULT_LIMIT } from '@/constants';
import type { PriceBounds } from '@/lib/server/types';
import { isNotFound, summarizeReviews } from '@/lib/server/utils';
import { sortValues } from '@/modules/products/search-params';
import type { Media, Product, Tenant, Review } from '@/payload-types';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';

import type { Sort, Where } from 'payload';

/** Media doc shape we care about (URL + optional sizes). */
type MediaDoc = Media & {
  url?: string | null;
  sizes?: {
    thumbnail?: { url?: string | null };
    medium?: { url?: string | null };
  };
};

/** Row in Products.images array. */
type ProductImagesRow = {
  image?: string | MediaDoc | null;
  alt?: string | null;
};

interface ProductWithInventory extends Product {
  trackInventory?: boolean;
  stockQuantity?: number;
  images?: ProductImagesRow[];
}

/** Map images[] to clean gallery items, preferring the "medium" size. */
/**
 * Convert a product images array into a sanitized gallery of URL/alt pairs.
 *
 * Accepts the ProductImagesRow[] structure produced by the data layer and returns
 * an array of objects each containing a resolved image `url` and optional `alt`.
 * For each populated image entry this prefers the `sizes.medium.url` value, falls
 * back to the top-level `url` on the media object, and skips entries that are
 * unpopulated or lack any usable URL.
 *
 * @param images - Array of product image rows (may be undefined or contain unpopulated entries)
 * @returns An array of `{ url, alt? }` objects suitable for frontend galleries; returns an empty array if input is not a valid array or contains no usable images.
 */
function mapGalleryFromImages(
  images: ProductImagesRow[] | undefined
): Array<{ url: string; alt?: string }> {
  if (!Array.isArray(images)) return [];
  const out: Array<{ url: string; alt?: string }> = [];
  for (const row of images) {
    if (!row?.image) continue;
    if (typeof row.image === 'string') continue; // not populated at this depth
    const media = row.image as MediaDoc;
    const url = media.sizes?.medium?.url ?? media.url ?? undefined;
    if (!url) continue;
    const alt = (row.alt ?? media.alt ?? undefined) || undefined;
    out.push({ url, alt });
  }
  return out;
}

export const productsRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });

      let product: ProductWithInventory;
      try {
        product = (await ctx.db.findByID({
          collection: 'products',
          // depth 2 -> images.image (media), cover (media), tenant.image (media)
          depth: 2,
          id: input.id,
          select: { content: false }
        })) as ProductWithInventory;
      } catch (error) {
        if (isNotFound(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product with ID: ${input.id} not found`
          });
        }
        throw error;
      }

      if (product.isArchived) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product has been archived'
        });
      }

      // Availability
      const trackInventory = Boolean(product.trackInventory);
      const stockQuantity = product.stockQuantity ?? 0;
      const inStock = !trackInventory || stockQuantity > 0;
      const isSoldOut = trackInventory && stockQuantity <= 0;

      // Has current user purchased?
      let isPurchased = false;
      if (session.user) {
        // 1) Try canonical field: buyer
        const ordersByBuyer = await ctx.db.find({
          collection: 'orders',
          pagination: false,
          limit: 1,
          where: {
            and: [
              { buyer: { equals: session.user.id } },
              { status: { in: ['paid', 'partially_refunded'] } },
              {
                or: [
                  { product: { equals: input.id } },
                  { 'items.product': { equals: input.id } }
                ]
              }
            ]
          }
        });

        if (ordersByBuyer.totalDocs > 0) {
          isPurchased = true;
        } else {
          // 2) Optional legacy fallback: user (guarded so it won’t explode if the path doesn’t exist)
          try {
            const legacyOrders = await ctx.db.find({
              collection: 'orders',
              pagination: false,
              limit: 1,
              where: {
                and: [
                  { user: { equals: session.user.id } }, // legacy path
                  { status: { in: ['paid', 'partially_refunded'] } },
                  {
                    or: [
                      { product: { equals: input.id } },
                      { 'items.product': { equals: input.id } }
                    ]
                  }
                ]
              }
            });
            isPurchased = legacyOrders.totalDocs > 0;
          } catch (e) {
            // Ignore schema-path errors for legacy field; rethrow unexpected errors
            const msg = (e as Error)?.message ?? '';
            if (!msg.includes('cannot be queried: user')) {
              throw e;
            }
          }
        }
      }

      // Reviews summary
      const reviews = await ctx.db.find({
        collection: 'reviews',
        pagination: false,
        where: { product: { equals: input.id } }
      });

      const reviewRating =
        reviews.docs.length > 0
          ? reviews.docs.reduce((sum, r) => sum + r.rating, 0) /
            reviews.totalDocs
          : 0;

      const ratingDistribution: Record<number, number> = {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
      };
      if (reviews.totalDocs > 0) {
        for (const r of reviews.docs) {
          if (r.rating >= 1 && r.rating <= 5)
            ratingDistribution[r.rating] =
              (ratingDistribution[r.rating] || 0) + 1;
        }
        for (const key of Object.keys(ratingDistribution)) {
          const k = Number(key);
          const count = ratingDistribution[k] || 0;
          ratingDistribution[k] = Math.round((count / reviews.totalDocs) * 100);
        }
      }

      const gallery = mapGalleryFromImages(product.images);

      const rawMode = product.shippingMode ?? 'free';
      const shippingMode: 'free' | 'flat' | 'calculated' =
        rawMode === 'free' || rawMode === 'flat' || rawMode === 'calculated'
          ? rawMode
          : 'free';

      const shippingFlatFeeUsd =
        typeof (product as { shippingFlatFee?: unknown }).shippingFlatFee ===
        'number'
          ? (product as { shippingFlatFee?: number }).shippingFlatFee
          : 0;
      const shippingFeeCentsPerUnit =
        shippingMode === 'flat'
          ? Math.max(0, Math.round((shippingFlatFeeUsd ?? 0) * 100))
          : 0;

      return {
        ...product,
        trackInventory,
        stockQuantity,
        inStock,
        isSoldOut,
        availabilityLabel: isSoldOut
          ? 'Sold out'
          : trackInventory
            ? `${stockQuantity} in stock`
            : 'Available',
        isPurchased,
        // keep cover (populated by depth: 2)
        cover: (product.cover as Media | null) ?? null,
        tenant: product.tenant as Tenant & { image: Media | null },
        reviewRating,
        reviewCount: reviews.totalDocs,
        ratingDistribution,
        gallery, // Array<{ url, alt? }> for the component under the description
        shippingMode,
        shippingFlatFee: shippingFlatFeeUsd,
        shippingFeeCentsPerUnit
      };
    }),

  getMany: baseProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT),

        category: z.string().nullable().optional(),
        subcategory: z.string().nullable().optional(),

        minPrice: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),

        tags: z.array(z.string()).nullable().optional(),

        sort: z.enum(sortValues).nullable().optional(),
        tenantSlug: z.string().nullable().optional(),

        // canonical text param
        q: z.string().nullable().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Where = { isArchived: { not_equals: true } };

      // Availability filter
      const availabilityFilter: Where = {
        or: [
          { trackInventory: { not_equals: true } },
          {
            and: [
              { trackInventory: { equals: true } },
              { stockQuantity: { greater_than: 0 } }
            ]
          }
        ]
      };

      // Sort
      let sort: Sort = '-createdAt';
      if (input.sort === 'curated') sort = '-createdAt';
      if (input.sort === 'hot_and_new') sort = '+createdAt';
      if (input.sort === 'trending') sort = '-createdAt';

      // Price bounds
      const minPriceNum =
        input.minPrice != null && input.minPrice !== ''
          ? Number(input.minPrice)
          : undefined;
      const maxPriceNum =
        input.maxPrice != null && input.maxPrice !== ''
          ? Number(input.maxPrice)
          : undefined;

      const priceFilter: PriceBounds = {};
      if (typeof minPriceNum === 'number' && Number.isFinite(minPriceNum)) {
        priceFilter.greater_than_equal = minPriceNum;
      }
      if (typeof maxPriceNum === 'number' && Number.isFinite(maxPriceNum)) {
        priceFilter.less_than_equal = maxPriceNum;
      }
      if (
        priceFilter.greater_than_equal !== undefined ||
        priceFilter.less_than_equal !== undefined
      ) {
        (where as Record<string, unknown>).price = priceFilter;
      }

      // Tags filter (any match)
      if (Array.isArray(input.tags) && input.tags.length > 0) {
        (where as Record<string, unknown>).tags = { in: input.tags };
      }

      // Tenant/public scope
      if (input.tenantSlug) {
        where['tenant.slug'] = { equals: input.tenantSlug };
      } else {
        where['isPrivate'] = { not_equals: true };
      }

      const q =
        typeof input.q === 'string' && input.q.trim() !== ''
          ? input.q.trim()
          : null;

      // Category/Subcategory
      if (input.subcategory) {
        const subRes = await ctx.db.find({
          collection: 'categories',
          limit: 1,
          depth: 0,
          where: { slug: { equals: input.subcategory } }
        });
        const sub = subRes.docs[0];

        if (!sub) {
          where.id = { equals: '__no_results__' };
        } else if (input.category) {
          const parentId =
            typeof sub.parent === 'object' ? sub.parent?.id : sub.parent;
          const parentRes = await ctx.db.find({
            collection: 'categories',
            limit: 1,
            depth: 0,
            where: { slug: { equals: input.category } }
          });
          const parentCat = parentRes.docs[0];

          if (!parentCat || String(parentId) !== String(parentCat.id)) {
            where.id = { equals: '__no_results__' };
          } else {
            where.subcategory = { equals: sub.id };
          }
        } else {
          where.subcategory = { equals: sub.id };
        }
      } else if (input.category) {
        const catRes = await ctx.db.find({
          collection: 'categories',
          limit: 1,
          depth: 0,
          where: { slug: { equals: input.category } }
        });
        const cat = catRes.docs[0];

        if (cat) {
          const childrenRes = await ctx.db.find({
            collection: 'categories',
            pagination: false,
            depth: 0,
            where: { parent: { equals: cat.id } }
          });
          const childIds = childrenRes.docs.map((d) => d.id);
          where.or = [
            { category: { equals: cat.id } },
            ...(childIds.length ? [{ subcategory: { in: childIds } }] : [])
          ];
        } else {
          where.id = { equals: '__no_results__' };
        }
      }

      // Final where: availability AND (optional) multi-field text search
      const andClauses: Where[] = [...(where.and ?? []), availabilityFilter];

      if (q) {
        // IMPORTANT: no %...% — Payload's `like` already does contains/ILIKE
        andClauses.push({
          or: [
            { name: { like: q } },
            { description: { like: q } },
            { 'tenant.name': { like: q } }
          ]
        });
      }

      const finalWhere: Where = {
        ...where,
        and: andClauses
      };

      const data = await ctx.db.find({
        collection: 'products',
        depth: 2, // cover + images.image + tenant.image populated
        where: finalWhere,
        sort,
        page: input.cursor,
        limit: input.limit,
        select: { content: false }
      });

      const ids = data.docs.map((d) => d.id);
      const reviewDocs =
        ids.length > 0
          ? (
              await ctx.db.find({
                collection: 'reviews',
                pagination: false,
                where: { product: { in: ids } }
              })
            ).docs
          : [];

      const summary = summarizeReviews(reviewDocs as Review[]);
      const docsWithRatings = data.docs.map((doc) => {
        const s = summary.get(doc.id) ?? { count: 0, avg: 0 };
        return { ...doc, reviewCount: s.count, reviewRating: s.avg };
      });

      return {
        ...data,
        docs: docsWithRatings
      };
    })
});
