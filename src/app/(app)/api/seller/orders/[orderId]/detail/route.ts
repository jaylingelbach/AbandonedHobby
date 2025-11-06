import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';
import { getFirstTenantId } from '@/modules/users/server/getFirstTenantId';

import { DECIMAL_PLATFORM_PERCENTAGE } from '@/constants';

import { zSellerOrderDetail } from '@/lib/validation/seller-order';

import { toIntCents } from '@/lib/money';

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await ctx.params;

  if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  try {
    // 1) Auth & current user via your tRPC context
    const trpcCtx = await createTRPCContext();
    const caller = appRouter.createCaller(trpcCtx);
    const session = await trpcCtx.db.auth({ headers: trpcCtx.headers });
    const roles: string[] = Array.isArray(
      (session.user as { roles?: string[] } | undefined)?.roles
    )
      ? ((session.user as { roles?: string[] }).roles as string[])
      : [];
    const me = await caller.users.me(); // protectedProcedure ensures auth
    const tenantId = getFirstTenantId(me.user);
    if (!tenantId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2) Load order from Payload
    const payload = await getPayload({ config });

    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0
    });

    // 3) Enforce seller owns this order (tenant match)

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

    if (
      !isSuperAdmin &&
      (!orderSellerTenant || (tenantId && orderSellerTenant !== tenantId))
    ) {
      return NextResponse.json(
        {
          error: 'Forbidden'
        },
        { status: 403 }
      );
    }

    if (!orderSellerTenant || orderSellerTenant !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4) Build seller-safe breakdown (server-authoritative totals)
    const rawItems = (order as { items?: unknown[] }).items ?? [];
    const items = Array.isArray(rawItems)
      ? rawItems.map((raw, index) => {
          // Prefer embedded subdocument id; fallback to _id; final fallback is orderId:index
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
    // Pull order-level amounts from the amounts group
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

    const storedStripeFeeCents = toIntCents(amountsGroup.stripeFeeCents ?? 0);

    const computedPlatformFeeCents = Math.max(
      0,
      Math.trunc(grossTotalCents * DECIMAL_PLATFORM_PERCENTAGE)
    );
    const platformFeeCents =
      toIntCents(amountsGroup.platformFeeCents ?? computedPlatformFeeCents) ||
      computedPlatformFeeCents;

    const sellerNetCents = Math.max(
      0,
      grossTotalCents - platformFeeCents - storedStripeFeeCents
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
        platformFeeCents,
        stripeFeeCents: storedStripeFeeCents,
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

    // Runtime validation
    const parsed = zSellerOrderDetail.safeParse(detailPayload);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          '[seller order detail] validation failed',
          parsed.error.format()
        );
      }
      return NextResponse.json(
        { error: 'Invalid order detail shape' },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(error);
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 404
    ) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
