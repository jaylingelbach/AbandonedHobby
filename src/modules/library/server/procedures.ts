import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { DEFAULT_LIMIT } from '@/constants';
import { getRelId, summarizeReviews } from '@/lib/server/utils';
import type { Media, Product, Review, Tenant } from '@/payload-types';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

import { pickPrimaryMedia } from './utils';

import type {
  ProductWithRatings,
  OrderMinimal,
  ProductCardDTO
} from '../types';

/**
 * Router: Library (purchased products for the signed-in user)
 *
 * Exposes read-only endpoints to fetch products the user owns.
 * Notes:
 * - Authorization: all procedures require an authenticated session
 * - Side-effects: none
 * - Errors: NOT_FOUND when product/order cannot be located for the user
 */

export const libraryRouter = createTRPCRouter({
  /**
   * getOne
   * Fetch a single product with ratings **only if** the current user owns it.
   *
   * Auth: required
   * Side-effects: none
   * Errors:
   *  - UNAUTHORIZED if no session
   *  - NOT_FOUND if the user does not own the product or product doesn't exist
   */
  getOne: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // 1) Ensure this user has an order for the product (handles legacy + items[])
      const ordersRes = (await ctx.db.find({
        collection: 'orders',
        pagination: false,
        depth: 0,
        sort: '-createdAt',
        where: { buyer: { equals: user.id } }
      })) as { docs: OrderMinimal[] };

      const hasOrder = ordersRes.docs.some((o) => {
        // legacy top-level product
        const top = getRelId(o.product ?? null);
        if (top === input.productId) return true;

        // new items[] product references
        if (Array.isArray(o.items)) {
          for (const it of o.items) {
            if (getRelId(it?.product ?? null) === input.productId) return true;
          }
        }
        return false;
      });

      if (!hasOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No order found' });
      }

      // 2) Fetch the product (depth for tenant/image/content)
      const product = (await ctx.db.findByID({
        collection: 'products',
        id: input.productId,
        depth: 2,
        overrideAccess: true
      })) as Product | null;

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
        });
      }

      // 3) Compute ratings for this one product
      const reviewsRes = (await ctx.db.find({
        collection: 'reviews',
        pagination: false,
        depth: 0,
        where: { product: { equals: input.productId } },
        overrideAccess: true // reviews are admin-only; aggregate server-side
      })) as { docs: Review[] };

      const summary = summarizeReviews(reviewsRes.docs).get(product.id) ?? {
        count: 0,
        avg: 0
      };

      const dto: ProductWithRatings = {
        ...product,
        // Keep these two computed fields for the UI
        reviewCount: summary.count,
        reviewRating: summary.avg
      };

      return dto;
    }),

  /**
   * getMany
   * Return a paginated list of the current user's purchased products.
   * Ordered by newest orders first. Merges review stats into each product.
   *
   * Auth: required
   * Side-effects: none
   * Errors:
   *  - UNAUTHORIZED if no session
   */
  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(DEFAULT_LIMIT)
      })
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // 1) Page through this user's orders (newest first)
      const orders = (await ctx.db.find({
        collection: 'orders',
        depth: 0,
        page: input.cursor,
        limit: input.limit,
        sort: '-createdAt',
        where: { buyer: { equals: user.id } }
      })) as {
        docs: OrderMinimal[];
        page: number;
        totalPages: number;
        totalDocs: number;
      };

      // 2) Collect product ids on this page + map newest orderId per product
      const productIdSet = new Set<string>();
      const latestOrderIdByProduct = new Map<string, string>();

      for (const order of orders.docs) {
        let foundInItems = false;
        if (Array.isArray(order.items) && order.items.length > 0) {
          for (const it of order.items) {
            const pid = getRelId(it?.product ?? null);
            if (pid) {
              productIdSet.add(pid);
              if (!latestOrderIdByProduct.has(pid))
                latestOrderIdByProduct.set(pid, order.id);
              foundInItems = true;
            }
          }
        }
        if (!foundInItems) {
          const pid = getRelId(order.product ?? null);
          if (pid) {
            productIdSet.add(pid);
            if (!latestOrderIdByProduct.has(pid))
              latestOrderIdByProduct.set(pid, order.id);
          }
        }
      }

      const productIds = Array.from(productIdSet);
      const nextPage = orders.page < orders.totalPages ? orders.page + 1 : null;

      if (productIds.length === 0) {
        return {
          docs: [] as ProductCardDTO[],
          nextPage,
          totalDocs: orders.totalDocs,
          totalPages: orders.totalPages
        };
      }

      // 3) Fetch products for those ids
      const productsRes = (await ctx.db.find({
        collection: 'products',
        pagination: false,
        depth: 2,
        where: { id: { in: productIds } }
      })) as { docs: Product[] };

      // 4) Reviews → summaries
      const reviewsRes = (await ctx.db.find({
        collection: 'reviews',
        pagination: false,
        depth: 0,
        where: { product: { in: productIds } },
        overrideAccess: true
      })) as { docs: Review[] };

      const summaries = summarizeReviews(reviewsRes.docs);

      // 5) Build normalized DTOs in the same order as productIds (recency)
      const productById = new Map(productsRes.docs.map((p) => [p.id, p]));

      const docs: ProductCardDTO[] = productIds.flatMap((pid) => {
        const p = productById.get(pid);
        if (!p) return []; // product deleted/filtered

        const orderId = latestOrderIdByProduct.get(pid);
        if (!orderId) return []; // safety

        const stats = summaries.get(pid) ?? { count: 0, avg: 0 };

        const normalizedImage: Media | null = pickPrimaryMedia(p);

        const tenantObj = (p.tenant as Tenant | null) ?? null;
        const normalizedTenant: (Tenant & { image: Media | null }) | null =
          tenantObj
            ? {
                ...tenantObj,
                image: (tenantObj.image as Media | null) ?? null
              }
            : null;

        return [
          {
            id: p.id,
            name: p.name,
            image: normalizedImage,
            tenant: normalizedTenant,
            reviewCount: stats.count,
            reviewRating: stats.avg,
            orderId
          }
        ];
      });

      return {
        docs,
        nextPage,
        totalDocs: orders.totalDocs,
        totalPages: orders.totalPages
      };
    })
});
