import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { daysForPolicy } from '@/lib/server/utils';
import {
  sendOrderConfirmationEmail,
  sendSaleNotificationEmail
} from '@/lib/sendEmail';

import type { Tenant, User, Product } from '@/payload-types';
import { CheckoutMetadata, ExpandedLineItem } from '@/modules/checkout/types';
import { posthogServer } from '@/lib/server/posthog-server';

export const runtime = 'nodejs';

// Stripe Connect webhook handler (events originate from connected accounts)
export async function POST(req: Request) {
  type TenantWithContact = Tenant & {
    notificationEmail?: string | null;
    notificationName?: string | null;
    primaryContact?: string | User | null; // id or populated
  };

  // ---- helpers  ----
  const isStringValue = (value: unknown): value is string =>
    typeof value === 'string';

  function itemHasProductId(item: { product?: string }): item is {
    product: string;
  } {
    return typeof item.product === 'string' && item.product.length > 0;
  }

  function requireStripeProductId(line: ExpandedLineItem): string {
    const stripeProduct = line.price?.product as Stripe.Product | undefined;
    const id = stripeProduct?.metadata?.id;
    if (!id) {
      throw new Error('Missing product id in Stripe product metadata.');
    }
    return id;
  }

  let event: Stripe.Event;

  try {
    const bodyText = await (await req.blob()).text();
    event = stripe.webhooks.constructEvent(
      bodyText,
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
    console.log('[webhook] event', {
      type: event.type,
      account: event.account ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Error';
    return NextResponse.json(
      { message: `Webhook error: ${message}` },
      { status: 400 }
    );
  }

  const permittedEvents: ReadonlyArray<string> = [
    'checkout.session.completed',
    'account.updated'
  ];

  if (!permittedEvents.includes(event.type)) {
    return NextResponse.json({ message: 'Ignored' }, { status: 200 });
  }

  const payload = await getPayload({ config });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // --- guards ---
        if (!session.metadata?.userId) {
          throw new Error('User ID is required');
        }
        if (!event.account) {
          throw new Error('Stripe account ID is required for order creation');
        }

        // buyer
        const user = (await payload.findByID({
          collection: 'users',
          id: session.metadata.userId
        })) as User | null;
        if (!user) {
          throw new Error('User is required');
        }

        // expanded session (from connected account)
        const expandedSession = await stripe.checkout.sessions.retrieve(
          session.id,
          {
            expand: [
              'line_items.data.price.product',
              'shipping',
              'customer_details'
            ]
          },
          { stripeAccount: event.account }
        );

        const lineItems = expandedSession.line_items?.data as
          | ExpandedLineItem[]
          | undefined;
        if (!lineItems || lineItems.length === 0) {
          throw new Error('No line items found');
        }

        const customer = expandedSession.customer_details;
        if (!customer) {
          throw new Error('Missing customer details');
        }

        const currency = expandedSession.currency?.toUpperCase();
        if (!currency) {
          throw new Error('Missing currency on Stripe session.');
        }

        // Receipt line items (for emails)
        const receiptLineItems = lineItems.map((line) => {
          const stripeProduct = line.price?.product as
            | Stripe.Product
            | undefined;
          const description = stripeProduct?.name ?? line.description ?? 'Item';
          const amountTotal =
            (typeof line.amount_total === 'number'
              ? line.amount_total
              : undefined) ??
            (line.price?.unit_amount ?? 0) * (line.quantity ?? 1);
          return {
            description,
            amount: `$${(amountTotal / 100).toFixed(2)}`
          };
        });

        // Total cents from lines (fallback to PI below if 0)
        const totalCentsFromLines = lineItems.reduce<number>((sum, line) => {
          const lineTotal =
            (typeof line.amount_total === 'number'
              ? line.amount_total
              : undefined) ??
            (line.price?.unit_amount ?? 0) * (line.quantity ?? 1);
          return sum + lineTotal;
        }, 0);
        let totalCents: number = totalCentsFromLines;

        // --- resolve tenant (metadata first, then by connected account) ---
        const rawMeta = expandedSession.metadata ?? {};
        const meta: Partial<CheckoutMetadata> = {
          userId: rawMeta.userId,
          tenantId: rawMeta.tenantId,
          tenantSlug: rawMeta.tenantSlug,
          sellerStripeAccountId: rawMeta.sellerStripeAccountId,
          productIds: rawMeta.productIds
        };

        let tenantDoc: TenantWithContact | null = null;

        if (meta.tenantId) {
          try {
            tenantDoc = (await payload.findByID({
              collection: 'tenants',
              id: meta.tenantId,
              depth: 1,
              overrideAccess: true
            })) as TenantWithContact;
          } catch {
            // fall back below
          }
        }

        if (!tenantDoc && event.account) {
          const lookupByAccount = await payload.find({
            collection: 'tenants',
            where: { stripeAccountId: { equals: event.account as string } },
            limit: 1,
            depth: 1,
            overrideAccess: true
          });
          tenantDoc = (lookupByAccount.docs[0] ??
            null) as TenantWithContact | null;
        }

        if (!tenantDoc) {
          throw new Error(
            `No tenant resolved. meta.tenantId=${meta.tenantId ?? 'null'} meta.tenantSlug=${meta.tenantSlug ?? 'null'} event.account=${event.account}`
          );
        }

        if (
          isStringValue(meta.sellerStripeAccountId) &&
          isStringValue(event.account) &&
          meta.sellerStripeAccountId !== event.account
        ) {
          console.warn(
            '[webhook] MISMATCH: event.account != metadata.sellerStripeAccountId',
            {
              eventAccount: event.account,
              metaSellerAccount: meta.sellerStripeAccountId
            }
          );
        }

        // --- payment details (for charge id & fallback total) ---
        const paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent as string,
          { expand: ['charges.data.payment_method_details'] },
          { stripeAccount: event.account }
        );

        const chargeId = paymentIntent.latest_charge;
        if (!chargeId) {
          throw new Error('No charge found on paymentIntent');
        }

        const charge = await stripe.charges.retrieve(chargeId as string, {
          stripeAccount: event.account
        });

        if (!totalCents && typeof paymentIntent.amount_received === 'number') {
          totalCents = paymentIntent.amount_received;
        }

        // --- build normalized items array for Orders schema ---
        // Ensure every item gets a product id (string), not undefined.
        const productIdsFromLines = lineItems.map(requireStripeProductId);

        const productsResult = (
          productIdsFromLines.length
            ? await payload.find({
                collection: 'products',
                depth: 0,
                where: { id: { in: productIdsFromLines } },
                overrideAccess: true
              })
            : { docs: [] }
        ) as { docs: Product[] };

        const productMap = new Map<string, Product>(
          productsResult.docs.map((productDoc) => [productDoc.id, productDoc])
        );

        // derive items
        const now = new Date();
        type RefundPolicyOption = Exclude<Product['refundPolicy'], null>;

        const orderItems = lineItems.map((line) => {
          const productId = requireStripeProductId(line);
          const productDoc = productMap.get(productId);

          const rawPolicy = productDoc?.refundPolicy ?? undefined;
          const policy: RefundPolicyOption | undefined =
            rawPolicy == null ? undefined : rawPolicy;

          const unitAmount = line.price?.unit_amount ?? 0;
          const quantity = line.quantity ?? 1;

          const returnsDate =
            policy && daysForPolicy(policy) > 0
              ? new Date(
                  now.getTime() + daysForPolicy(policy) * 24 * 60 * 60 * 1000
                )
              : undefined;

          const returnsISO: string | undefined = returnsDate
            ? returnsDate.toISOString()
            : undefined;

          const amountSubtotal =
            (typeof line.amount_subtotal === 'number'
              ? line.amount_subtotal
              : undefined) ?? unitAmount * quantity;
          const amountTax =
            (typeof line.amount_tax === 'number'
              ? line.amount_tax
              : undefined) ?? undefined;
          const amountTotal =
            (typeof line.amount_total === 'number'
              ? line.amount_total
              : undefined) ?? unitAmount * quantity;

          const stripeProduct = line.price?.product as
            | Stripe.Product
            | undefined;
          const nameSnapshot =
            stripeProduct?.name ?? line.description ?? 'Item';

          // IMPORTANT: product is guaranteed string here
          return {
            product: productId,
            nameSnapshot,
            unitAmount,
            quantity,
            amountSubtotal,
            amountTax,
            amountTotal,
            refundPolicy: policy,
            returnsAcceptedThrough: returnsISO // string | undefined
          };
        });

        // order-level returns cutoff (earliest accepting item) -> ISO string
        const itemReturnDates = orderItems
          .map((item) =>
            item.returnsAcceptedThrough
              ? new Date(item.returnsAcceptedThrough)
              : null
          )
          .filter((d): d is Date => d instanceof Date);

        const returnsAcceptedThroughISO: string | undefined =
          itemReturnDates.length > 0
            ? new Date(
                Math.min(...itemReturnDates.map((d) => d.getTime()))
              ).toISOString()
            : undefined;

        // first defined product id for back-compat required field
        const firstProductId = orderItems.find(itemHasProductId)?.product;
        if (!firstProductId) {
          throw new Error('No product id resolved from Stripe line items.');
        }

        // order number & display name
        const orderNumber = `AH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        const firstName = orderItems[0]?.nameSnapshot ?? 'Order';
        const orderName =
          orderItems.length > 1
            ? `${firstName} (+${orderItems.length - 1} more)`
            : firstName;

        // Guard against duplicate orders on stripe retry.
        const existing = await payload.find({
          collection: 'orders',
          where: { stripeCheckoutSessionId: { equals: session.id } },
          limit: 1,
          depth: 0,
          overrideAccess: true
        });

        if (existing.totalDocs > 0) {
          console.log('[webhook] duplicate session, skipping create', {
            sessionId: session.id
          });
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // --- create one order (items array, total in cents) ---
        const orderDoc = await payload.create({
          collection: 'orders',
          data: {
            name: orderName,
            orderNumber,
            buyer: user.id, // schema requires both buyer and user
            user: user.id,
            sellerTenant: tenantDoc.id,
            currency,
            product: firstProductId, // back-compat field
            stripeAccountId: event.account,
            stripeCheckoutSessionId: session.id,
            stripeChargeId: charge.id,
            items: orderItems,
            returnsAcceptedThrough: returnsAcceptedThroughISO, // string | undefined (OK for string | null | undefined)
            buyerEmail: customer.email ?? undefined,
            status: 'paid',
            total: totalCents,
            shipping: {
              name: customer.name ?? 'Customer',
              line1: customer.address?.line1,
              line2: customer.address?.line2,
              city: customer.address?.city,
              state: customer.address?.state,
              postalCode: customer.address?.postal_code,
              country: customer.address?.country
            }
          },
          overrideAccess: true
        });
        // ---- emails ----
        const summary = receiptLineItems.map((i) => i.description).join(', ');

        const { name, address } = customer;
        if (!name)
          throw new Error('Cannot send sale email: customer name is missing');
        if (!address?.line1)
          throw new Error('Cannot send sale email: address line 1 is missing');
        if (!address?.city)
          throw new Error('Cannot send sale email: shipping city is missing');
        if (!address?.state)
          throw new Error('Cannot send sale email: shipping state is missing');
        if (!address.postal_code)
          throw new Error(
            'Cannot send sale email: shipping postal code is missing'
          );
        if (!address.country)
          throw new Error(
            'Cannot send sale email: shipping country is missing'
          );

        // figure seller notification target
        const primaryRef = tenantDoc.primaryContact;
        let primaryContactUser: User | null = null;

        if (typeof primaryRef === 'string') {
          try {
            primaryContactUser = (await payload.findByID({
              collection: 'users',
              id: primaryRef,
              depth: 0,
              overrideAccess: true
            })) as User;
          } catch {
            primaryContactUser = null;
          }
        } else if (primaryRef && typeof primaryRef === 'object') {
          primaryContactUser = primaryRef as User;
        }

        const sellerEmail: string | null =
          tenantDoc.notificationEmail ?? primaryContactUser?.email ?? null;

        const tenantId = tenantDoc.id;

        const sellerNameFinal: string =
          tenantDoc.notificationName ??
          primaryContactUser?.firstName ??
          (primaryContactUser ? primaryContactUser.username : undefined) ??
          tenantDoc.name ??
          'Seller';

        // Buyer email
        await sendOrderConfirmationEmail({
          to: 'jay@abandonedhobby.com', // replace with user.email when ready
          name: user.firstName,
          creditCardStatement: charge.statement_descriptor ?? 'ABANDONED HOBBY',
          creditCardBrand: charge.payment_method_details?.card?.brand ?? 'N/A',
          creditCardLast4: charge.payment_method_details?.card?.last4 ?? '0000',
          receiptId: String(orderDoc.id),
          orderDate: new Date().toLocaleDateString('en-US'),
          lineItems: receiptLineItems,
          total: `$${(totalCents / 100).toFixed(2)}`,
          support_url:
            process.env.SUPPORT_URL || 'https://abandonedhobby.com/support',
          item_summary: summary
        });

        if (!sellerEmail) {
          throw new Error(
            `No seller notification email configured for tenant ${tenantDoc.id}`
          );
        }

        // Seller email
        await sendSaleNotificationEmail({
          to: 'jay@abandonedhobby.com', // replace with sellerEmail when ready
          sellerName: sellerNameFinal,
          receiptId: String(orderDoc.id),
          orderDate: new Date().toLocaleDateString('en-US'),
          lineItems: receiptLineItems,
          total: `$${(totalCents / 100).toFixed(2)}`,
          item_summary: summary,
          shipping_name: customer.name!,
          shipping_address_line1: address.line1!,
          shipping_address_line2: address.line2 ?? undefined,
          shipping_city: address.city!,
          shipping_state: address.state!,
          shipping_zip: address.postal_code!,
          shipping_country: address.country!,
          support_url:
            process.env.SUPPORT_URL || 'https://abandonedhobby.com/support'
        });

        posthogServer?.capture({
          distinctId: user.id ?? session.customer_email ?? 'unknown',
          event: 'purchaseCompleted',
          properties: {
            stripeSessionId: session.id,
            amountTotal: session.amount_total, // cents
            currency: session.currency?.toUpperCase(),
            productIdsFromLines,
            tenantId
          },
          groups: tenantId ? { tenant: tenantId } : undefined
        });

        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await payload.update({
          collection: 'tenants',
          where: { stripeAccountId: { equals: account.id } },
          data: { stripeDetailsSubmitted: account.details_submitted }
        });
        return NextResponse.json({ updated: true }, { status: 200 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Webhook handler failed:', message);
    return NextResponse.json(
      { message: `Webhook handler failed: ${message}` },
      { status: 500 }
    );
  }
}
