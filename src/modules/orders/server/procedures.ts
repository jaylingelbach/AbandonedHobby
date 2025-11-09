import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getRelId } from '@/lib/server/utils';
import { getPrimaryCardImageUrl } from '@/lib/utils';
import type { Order, Product, Tenant } from '@/payload-types';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

import {
  OrderSummaryDTO,
  OrderListItem,
  OrderConfirmationDTO,
  ShipmentDTO
} from '../types';
import { mapOrderToSummary, mapOrderToConfirmation } from './utils';
import { relId } from '@/lib/relationshipHelpers';
import { buildSellerOrdersWhere, mapOrderToBuyer } from './utils';

export const ordersRouter = createTRPCRouter({
  getSummaryBySession: protectedProcedure
    .input(
      z.object({
        sessionId: z
          .string()
          .regex(/^cs_[A-Za-z0-9_]+$/, 'Invalid session format')
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
        },
        overrideAccess: true
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
        },
        overrideAccess: true
      });

      const orders: OrderConfirmationDTO[] = result.docs.map((doc) => {
        const dto = mapOrderToConfirmation(doc);
        return dto;
      });
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
        overrideAccess: true,
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
        depth: 0 // we only need ids for relationships
      })) as Order | null;

      if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

      // buyer check
      const buyerId =
        typeof order.buyer === 'string' ? order.buyer : order.buyer?.id;
      if (buyerId !== user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      const items = Array.isArray(order.items) ? order.items : [];

      // Resolve primary product id for this page (prefer first item; fallback to legacy order.product)
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

      // Per-product quantity (sum only lines matching productId)
      const quantityForProduct =
        items.reduce<number>((sum, item) => {
          const id = getRelId(item.product);
          const q = typeof item.quantity === 'number' ? item.quantity : 1;
          return id === productId ? sum + q : sum;
        }, 0) || 1;

      // Optional: all product ids in this order (unique)
      const productIds = Array.from(
        new Set(
          items
            .map((i) => getRelId(i.product))
            .filter((id): id is string => typeof id === 'string')
        )
      );

      // Shape shipping from the order doc (matches your ShippingAddress type)
      const shipping =
        order.shipping && typeof order.shipping === 'object'
          ? {
              name: order.shipping.name ?? null,
              line1: order.shipping.line1 ?? '', // your type requires line1
              line2: order.shipping.line2 ?? null,
              city: order.shipping.city ?? null,
              state: order.shipping.state ?? null,
              postalCode: order.shipping.postalCode ?? null,
              country: order.shipping.country ?? null
            }
          : undefined;

      const shipment =
        order.shipment && typeof order.shipment === 'object'
          ? {
              carrier:
                (order.shipment as { carrier?: ShipmentDTO['carrier'] })
                  .carrier ?? undefined,
              trackingNumber: (() => {
                const tn =
                  (order.shipment as { trackingNumber?: string | null })
                    .trackingNumber ?? null;
                return tn && tn.trim() !== '' ? tn : null;
              })(),
              shippedAtISO: (() => {
                const raw =
                  (order.shipment as { shippedAt?: string | Date | null })
                    .shippedAt ?? null;
                if (!raw) return null;
                return raw instanceof Date ? raw.toISOString() : raw;
              })()
            }
          : undefined;

      return {
        orderId: String(order.id),
        orderNumber: order.orderNumber,
        orderDateISO: order.createdAt,
        returnsAcceptedThroughISO: order.returnsAcceptedThrough ?? null,
        currency: order.currency,
        totalCents: order.total,
        quantity: quantityForProduct,
        productId,
        productIds,
        shipping,
        shipment
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
        overrideAccess: true,
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

        // Resolve image from cover → images[0]
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
    }),
  getForBuyerFull: protectedProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const doc = (await ctx.db.findByID({
        collection: 'orders',
        id: input.orderId,
        depth: 0,
        overrideAccess: false,
        req: { user: ctx.session.user }
      })) as Order | null;

      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });

      // Buyer guard (defense in depth; access layer should already filter)
      const buyerId = relId(doc.buyer);
      if (!buyerId || buyerId !== ctx.session.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return mapOrderToBuyer(doc);
    }),

  listForSeller: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        status: z
          .array(z.enum(['unfulfilled', 'shipped', 'delivered', 'returned']))
          .optional(),
        query: z.string().trim().optional(), // order # or buyer email
        hasTracking: z.enum(['yes', 'no']).optional(),
        fromISO: z.string().datetime().optional(),
        toISO: z.string().datetime().optional(),
        sort: z.enum(['createdAtDesc', 'createdAtAsc']).default('createdAtDesc')
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      if (!session?.user?.id)
        return { items: [], total: 0, page: 1, pageSize: input.pageSize };

      // Optional: assert user belongs to tenantId (if you store it in user.tenants[])
      // (defense in depth; your access layer should already enforce read scope)

      const where = buildSellerOrdersWhere(input);

      const result = await db.find({
        collection: 'orders',
        where,
        sort: input.sort === 'createdAtAsc' ? 'createdAt' : '-createdAt',
        page: input.page,
        limit: input.pageSize,
        depth: 0,
        overrideAccess: false
      });

      type Row = {
        id: string;
        orderNumber?: string;
        createdAt: string;
        buyerEmail?: string | null;
        total?: number;
        currency?: string | null;
        fulfillmentStatus?:
          | 'unfulfilled'
          | 'shipped'
          | 'delivered'
          | 'returned';
        shipment?: {
          carrier?: 'usps' | 'ups' | 'fedex' | 'other';
          trackingNumber?: string | null;
        };
        items?: unknown[];
      };

      const items = (result.docs as Row[]).map((order) => ({
        id: String(order.id),
        orderNumber: order.orderNumber ?? null,
        createdAt: order.createdAt,
        buyerEmail: order.buyerEmail ?? null,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        totalCents: typeof order.total === 'number' ? order.total : 0,
        currency: order.currency ?? null,
        status: order.fulfillmentStatus ?? 'unfulfilled',
        carrier: order.shipment?.carrier ?? undefined,
        trackingNumber: order.shipment?.trackingNumber?.trim() || undefined
      }));

      return {
        items,
        total: (result as { totalDocs?: number }).totalDocs ?? items.length,
        page: (result as { page?: number }).page ?? input.page,
        pageSize: input.pageSize
      };
    })
});
