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

    // ── Preserve explicit zeros from DB for fees ───────────────────────────────
    const rawStoredPlatformFee = (
      amountsGroup as { platformFeeCents?: unknown }
    ).platformFeeCents;
    const rawStoredStripeFee = (amountsGroup as { stripeFeeCents?: unknown })
      .stripeFeeCents;

    const storedPlatformFeeCents = toIntCents(rawStoredPlatformFee);
    const storedStripeFeeCents = toIntCents(rawStoredStripeFee);

    const fallbackPlatformFeeCents = Math.max(
      0,
      Math.round(itemsSubtotalCents * DECIMAL_PLATFORM_PERCENTAGE)
    );

    const platformFeeCents =
      rawStoredPlatformFee != null
        ? storedPlatformFeeCents
        : fallbackPlatformFeeCents;

    // Processing-only Stripe fee: if absent, do NOT guess. Keep zero if explicitly stored as 0.
    const stripeFeeCents =
      rawStoredStripeFee != null ? storedStripeFeeCents : 0;

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
        platformFeeCents, // application fee (from DB if present, zero allowed)
        stripeFeeCents, // processing-only (from DB if present, zero allowed)
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
        // eslint-disable-next-line no-console
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
        rawStoredPlatformFee,
        rawStoredStripeFee,
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
    // eslint-disable-next-line no-console
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
