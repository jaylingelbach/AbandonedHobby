import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';
import { getFirstTenantId } from '@/modules/users/server/getFirstTenantId';

import { DECIMAL_PLATFORM_PERCENTAGE } from '@/constants';
import { zSellerOrderDetail } from '@/lib/validation/seller-order';
import { toIntCents } from '@/lib/money';
import type { SellerOrderDetail } from './types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Handle GET requests for a seller's order detail by orderId, validate access, compute amounts, and return a normalized order detail payload.
 *
 * Validates the `orderId` route parameter, enforces tenant-based authorization, assembles an items snapshot and amounts (preferring DB-stored fee values with safe fallbacks), validates the resulting shape, and returns it. When the environment variable `SELLER_ORDER_DETAIL_DEBUG` is enabled (and not in production), the response will include an `_debug` object with internal computed values.
 *
 * @param _request - The incoming NextRequest (unused).
 * @param ctx - Request context containing `params`, a Promise that resolves to an object with `orderId`.
 * @returns A JSON NextResponse: on success the body is a `SellerOrderDetail` object; on error the body is `{ error: string }` with one of the status codes 400 (invalid order id), 403 (forbidden), 404 (order not found), or 500 (invalid payload shape or unexpected error).
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await ctx.params;
  if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  const SELLER_ORDER_DETAIL_DEBUG: boolean = /^(1|true|yes)$/i.test(
    process.env.SELLER_ORDER_DETAIL_DEBUG ?? ''
  );

  try {
    // auth / tenancy
    const trpcCtx = await createTRPCContext();
    const caller = appRouter.createCaller(trpcCtx);
    const session = await trpcCtx.db.auth({ headers: trpcCtx.headers });
    const roles: string[] = Array.isArray(
      (session.user as { roles?: string[] } | undefined)?.roles
    )
      ? ((session.user as { roles?: string[] }).roles as string[])
      : [];
    const me = await caller.users.me();
    const tenantId = getFirstTenantId(me.user);
    if (!tenantId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // load order
    const payload = await getPayload({ config });
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0
    });

    // tenancy check
    const orderSellerTenant =
      typeof (order as { sellerTenant?: unknown }).sellerTenant === 'string'
        ? (order as { sellerTenant?: string }).sellerTenant
        : ((order as { sellerTenant?: { id?: string } }).sellerTenant?.id ??
          null);

    const isSuperAdmin = roles.includes('super-admin');
    if (
      !isSuperAdmin &&
      (!orderSellerTenant || orderSellerTenant !== tenantId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // items snapshot
    const rawItems = (order as { items?: unknown[] }).items ?? [];
    const items = Array.isArray(rawItems)
      ? rawItems.map((raw, index) => {
          const lineItemId = String(
            (raw as { id?: unknown }).id ??
              (raw as { _id?: unknown })._id ??
              `${order.id}:${index}`
          );
          const nameSnapshot =
            (raw as { nameSnapshot?: unknown }).nameSnapshot ??
            (raw as { product?: { name?: unknown } }).product?.name ??
            'Item';
          const quantity = Math.max(
            1,
            Math.trunc(Number((raw as { quantity?: unknown }).quantity ?? 1))
          );
          const unitAmountCents = toIntCents(
            (raw as { unitAmount?: unknown }).unitAmount ?? 0
          );
          const amountTotalCents = toIntCents(
            (raw as { amountTotal?: unknown }).amountTotal ??
              unitAmountCents * quantity
          );
          return {
            lineItemId,
            nameSnapshot: String(nameSnapshot),
            quantity,
            unitAmountCents,
            amountTotalCents
          };
        })
      : [];

    const itemsSubtotalCents = items.reduce(
      (sum, it) => sum + it.amountTotalCents,
      0
    );

    // amounts group from DB
    const amountsGroup =
      (
        order as {
          amounts?: {
            shippingTotalCents?: unknown;
            discountTotalCents?: unknown;
            taxTotalCents?: unknown;
            platformFeeCents?: unknown;
            stripeFeeCents?: unknown;
          };
        }
      ).amounts ?? {};

    const shippingCents = toIntCents(amountsGroup.shippingTotalCents ?? 0);
    const discountCents = toIntCents(amountsGroup.discountTotalCents ?? 0);
    const taxCents = toIntCents(amountsGroup.taxTotalCents ?? 0);

    const grossTotalCents = Math.max(
      0,
      Math.trunc(itemsSubtotalCents + shippingCents - discountCents + taxCents)
    );

    // 🔒 Prefer truth from DB (set by webhook/backfill). Only fall back if missing or <= 0.
    const storedPlatformFeeCents = toIntCents(amountsGroup.platformFeeCents);
    const storedStripeFeeCents = toIntCents(amountsGroup.stripeFeeCents);

    const fallbackPlatformFeeCents = Math.max(
      0,
      Math.round(itemsSubtotalCents * DECIMAL_PLATFORM_PERCENTAGE)
    );

    const platformFeeCents =
      storedPlatformFeeCents > 0
        ? storedPlatformFeeCents
        : fallbackPlatformFeeCents;

    // Stripe fee should be processing-only; if absent, do NOT try to guess it.
    // Keep zero rather than inventing a value.
    const stripeFeeCents = storedStripeFeeCents > 0 ? storedStripeFeeCents : 0;

    const sellerNetCents = Math.max(
      0,
      grossTotalCents - platformFeeCents - stripeFeeCents
    );

    const detailPayload = {
      id: String(order.id),
      orderNumber: String(
        (order as { orderNumber?: unknown }).orderNumber ?? order.id
      ),
      createdAtISO: String((order as { createdAt?: unknown }).createdAt ?? ''),
      currency: String(
        (order as { currency?: unknown }).currency ?? 'USD'
      ).toUpperCase(),
      buyerEmail: (order as { buyerEmail?: unknown }).buyerEmail ?? null,
      shipping: (order as { shipping?: unknown }).shipping ?? null,
      tracking: (order as { shipment?: unknown }).shipment ?? null,
      items,
      amounts: {
        itemsSubtotalCents,
        shippingCents,
        discountCents,
        taxCents,
        grossTotalCents,
        platformFeeCents, // ← application fee (from DB if present)
        stripeFeeCents, // ← processing-only (from DB if present)
        sellerNetCents
      },
      stripe: {
        paymentIntentId:
          (order as { stripePaymentIntentId?: unknown })
            .stripePaymentIntentId ?? null,
        chargeId:
          (order as { stripeChargeId?: unknown }).stripeChargeId ?? null,
        receiptUrl:
          ((order as { documents?: { receiptUrl?: unknown } }).documents
            ?.receiptUrl as string | null) ?? null
      }
    };

    const parsed = zSellerOrderDetail.safeParse(detailPayload);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          '[seller order detail] validation failed',
          parsed.error.format()
        );
      }
      const resp = NextResponse.json(
        { error: 'Invalid order detail shape' },
        { status: 500 }
      );
      resp.headers.set('Cache-Control', 'no-store');
      return resp;
    }

    const respData = parsed.data as SellerOrderDetail & { _debug?: unknown };

    if (SELLER_ORDER_DETAIL_DEBUG && process.env.NODE_ENV !== 'production') {
      respData._debug = {
        rawAmountsGroup: amountsGroup,
        itemsSubtotalCents,
        shippingCents,
        discountCents,
        taxCents,
        grossTotalCents,
        storedPlatformFeeCents,
        storedStripeFeeCents,
        fallbackPlatformFeeCents,
        platformFeeCents,
        stripeFeeCents
      };
      const debugResp = NextResponse.json(respData, { status: 200 });
      debugResp.headers.set('Cache-Control', 'no-store');
      return debugResp;
    }

    const resp = NextResponse.json(parsed.data, { status: 200 });
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    console.error('[seller-order-detail] unexpected error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: number }).status === 404
    ) {
      const resp = NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
      resp.headers.set('Cache-Control', 'no-store');
      return resp;
    }
    const resp = NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 }
    );
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  }
}