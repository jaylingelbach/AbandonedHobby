import z from 'zod';
import type { Order, Product, Tenant } from '@/payload-types';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { TRPCError } from '@trpc/server';
import { getRelId } from '@/lib/server/utils';
import { OrderSummaryDTO, OrderListItem, OrderConfirmationDTO } from '../types';
import { mapOrderToConfirmation, mapOrderToSummary } from './utils';
import { getPrimaryCardImageUrl } from '@/lib/utils';

export const ordersRouter = createTRPCRouter({
  getSummaryBySession: protectedProcedure
    .input(
      z.object({
        sessionId: z
          .string()
          .min(1)
          .regex(/^cs_[a-zA-Z0-9]+$/, 'Invalid session format')
      })
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Ensure your webhook sets `stripeCheckoutSessionId` on Orders
      const result = await ctx.db.find({
        collection: 'orders',
        depth: 0,
        where: {
          and: [
            { stripeCheckoutSessionId: { equals: input.sessionId } },
            { buyer: { equals: user.id } }
          ]
        }
      });

      const summaries: OrderSummaryDTO[] = result.docs.map(mapOrderToSummary);
      return { orders: summaries };
    }),
  getConfirmationBySession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Your webhook stores stripeCheckoutSessionId on the Order
      const result = await ctx.db.find({
        collection: 'orders',
        depth: 1, // pull tenant.slug if available for CTAs
        where: {
          and: [
            { stripeCheckoutSessionId: { equals: input.sessionId } },
            { buyer: { equals: user.id } }
          ]
        }
      });

      const orders: OrderConfirmationDTO[] = result.docs.map(
        mapOrderToConfirmation
      );
      return { orders };
    }),
  getLatestForProduct: protectedProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<OrderSummaryDTO | null> => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const userId = ctx.session.user?.id;

      const res = (await ctx.db.find({
        collection: 'orders',
        depth: 0,
        where: {
          and: [
            { buyer: { equals: userId } },
            { product: { equals: input.productId } } // legacy top-level field
          ]
        },
        sort: '-createdAt',
        limit: 1
      })) as { docs: Order[]; totalDocs: number };

      if (res.totalDocs === 0) return null;

      const doc = res.docs[0];
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });

      const items = Array.isArray(doc.items) ? doc.items : [];

      // 📌 Per-product quantity for the requested productId
      const quantityForProduct =
        items.reduce<number>((sum, item) => {
          const rel =
            typeof item.product === 'string'
              ? item.product
              : ((item.product as Product | null)?.id ?? '');
          const q = typeof item.quantity === 'number' ? item.quantity : 1;
          return rel === input.productId ? sum + q : sum;
        }, 0) || 1;

      return {
        orderId: String(doc.id),
        orderNumber: doc.orderNumber,
        orderDateISO: doc.createdAt,
        returnsAcceptedThroughISO: doc.returnsAcceptedThrough ?? null,
        currency: doc.currency,
        totalCents: doc.total,
        quantity: quantityForProduct, // ← per-product
        productId: input.productId
      };
    }),

  getForBuyerById: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }): Promise<OrderSummaryDTO> => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const order = (await ctx.db.findByID({
        collection: 'orders',
        id: input.orderId,
        depth: 0
      })) as Order | null;

      if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

      // safe buyer check
      const buyerId =
        typeof order.buyer === 'string' ? order.buyer : order.buyer?.id;
      if (buyerId !== user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      const items = Array.isArray(order.items) ? order.items : [];

      // Resolve the "primary" productId this order page is for
      // (prefer item.product, fallback to legacy order.product)

      let productId: string | null = null;
      for (const item of items) {
        const id = getRelId(item.product);
        if (id) {
          productId = id;
          break;
        }
      }
      if (!productId) {
        const legacy = getRelId(order.product);
        if (legacy) productId = legacy;
      }
      if (!productId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order has no product'
        });
      }

      // 📌 Per-product quantity (sum only the lines matching productId)
      const quantityForProduct =
        items.reduce<number>((sum, item) => {
          const id = getRelId(item.product);
          const q = typeof item.quantity === 'number' ? item.quantity : 1;
          return id === productId ? sum + q : sum;
        }, 0) || 1; // default to 1 if no explicit match (back-compat)

      return {
        orderId: String(order.id),
        orderNumber: order.orderNumber,
        orderDateISO: order.createdAt,
        returnsAcceptedThroughISO: order.returnsAcceptedThrough ?? null,
        currency: order.currency,
        totalCents: order.total,
        quantity: quantityForProduct, // ← per-product
        productId
      };
    }),

  listForBuyer: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const page = input.page ?? 1;
      const limit = input.limit ?? 24;

      const asProduct = (
        rel: string | Product | null | undefined
      ): Product | null =>
        rel && typeof rel === 'object' ? (rel as Product) : null;

      // keep this small guard for tenant slug
      const tenantSlug = (
        rel: string | Tenant | null | undefined
      ): string | undefined =>
        rel && typeof rel === 'object' && typeof rel.slug === 'string'
          ? rel.slug
          : undefined;

      const res = (await ctx.db.find({
        collection: 'orders',
        where: { buyer: { equals: user.id } },
        sort: '-createdAt',
        page,
        limit,
        depth: 2
      })) as {
        docs: Order[];
        page: number;
        totalPages: number;
      };

      const docs: OrderListItem[] = res.docs.map((order) => {
        // prefer top-level product; fall back to first item
        let productDoc = asProduct(order.product);
        if (!productDoc && Array.isArray(order.items)) {
          for (const item of order.items) {
            const maybe = asProduct(item.product);
            if (maybe) {
              productDoc = maybe;
              break;
            }
          }
        }

        const productId =
          getRelId(order.product) ??
          (Array.isArray(order.items)
            ? getRelId(order.items[0]?.product)
            : null) ??
          '';

        const productName =
          productDoc?.name ??
          (Array.isArray(order.items)
            ? order.items[0]?.nameSnapshot
            : undefined) ??
          'Item';

        // NEW: resolve image from cover → images[0]
        const productImageURL = productDoc
          ? (getPrimaryCardImageUrl(productDoc, 'thumbnail') ?? undefined)
          : undefined;

        const sellerSlug = productDoc
          ? tenantSlug(productDoc.tenant)
          : undefined;

        return {
          orderId: String(order.id),
          orderNumber: order.orderNumber,
          orderDateISO: order.createdAt,
          totalCents: order.total,
          currency: order.currency,
          productId,
          productName,
          productImageURL,
          tenantSlug: sellerSlug
        };
      });

      const nextPage = res.page < res.totalPages ? res.page + 1 : null;

      return { docs, nextPage };
    })
});
