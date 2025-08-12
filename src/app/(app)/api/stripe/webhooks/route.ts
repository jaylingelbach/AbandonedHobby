import Stripe from 'stripe';
import { getPayload } from 'payload';
import config from '@payload-config';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { CheckoutMetadata, ExpandedLineItem } from '@/modules/checkout/types';
import {
  sendOrderConfirmationEmail,
  sendSaleNotificationEmail
} from '@/lib/sendEmail';

import type { Tenant, User } from '@/payload-types';
import { Order } from '@/payload-types';

// stripeAccountId is for the SELLER. The buyer does not need one.
export async function POST(req: Request) {
  type TenantWithContact = Tenant & {
    notificationEmail?: string | null;
    notificationName?: string | null;
    primaryContact?: string | User | null; // id or populated
  };

  let event: Stripe.Event;

  console.log('🔥 Webhook endpoint hit');

  try {
    event = stripe.webhooks.constructEvent(
      await (await req.blob()).text(),
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown Error';
    if (error instanceof Error) {
      console.log(error.message);
    } else {
      console.log(error);
    }
    console.log(`❌ Error message: ${errorMessage}`);
    return NextResponse.json(
      { message: `Webhook error: ${errorMessage}` },
      { status: 400 }
    );
  }

  const permittedEvents: string[] = [
    'checkout.session.completed',
    'account.updated'
  ];
  const payload = await getPayload({ config });

  if (permittedEvents.includes(event.type)) {
    let data;

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          {
            data = event.data.object as Stripe.Checkout.Session;
            if (!data.metadata?.userId) {
              throw new Error('User ID is required');
            }
            const user = await payload.findByID({
              collection: 'users',
              id: data.metadata.userId
            });
            if (!user) {
              throw new Error('User is required');
            }
            if (!event.account) {
              throw new Error(
                'Stripe account ID is required for order creation'
              );
            }
            const expandedSession = await stripe.checkout.sessions.retrieve(
              data.id,
              {
                expand: [
                  'line_items.data.price.product',
                  'shipping',
                  'customer_details'
                ]
              },
              {
                stripeAccount: event.account
              }
            );
            if (
              !expandedSession.line_items?.data ||
              !expandedSession.line_items?.data.length
            ) {
              throw new Error('No line items found'); // couldn't load the purchase
            }

            const lineItems = expandedSession.line_items
              .data as ExpandedLineItem[];

            const customer = expandedSession.customer_details;
            if (!customer) throw new Error('Missing customer details');

            // Store created orders and line item details for the receipt
            const createdOrders: Order[] = [];
            const receiptLineItems: { description: string; amount: string }[] =
              [];

            for (const item of lineItems) {
              const order = await payload.create({
                collection: 'orders',
                data: {
                  stripeCheckoutSessionId: data.id,
                  stripeAccountId: event.account,
                  user: user.id,
                  product: item.price.product.metadata.id,
                  name: item.price.product.name,
                  total: data.amount_total ?? 0
                }
              });

              createdOrders.push(order);

              receiptLineItems.push({
                description: item.price.product.name,
                amount: `$${(item.amount_total / 100).toFixed(2)}`
              });
            }

            if (!createdOrders.length) {
              throw new Error('No orders were created');
            }

            const order = createdOrders[0];

            if (!order) {
              throw new Error('Order is unexpectedly undefined');
            }
            console.log(`expanded session! ${expandedSession}`);

            // payment details
            const paymentIntent = await stripe.paymentIntents.retrieve(
              data.payment_intent as string,
              { expand: ['charges.data.payment_method_details'] },
              { stripeAccount: event.account }
            );

            const chargeId = paymentIntent.latest_charge;
            if (!chargeId) throw new Error('No charge found on paymentIntent');

            const charge = await stripe.charges.retrieve(chargeId as string, {
              stripeAccount: event.account
            });

            const summary = receiptLineItems
              .map((item) => item.description)
              .join(', ');

            // Early guards for email fields
            const { name, address } = customer;

            if (!name)
              throw new Error(
                'Cannot send sale email: customer name is missing'
              );
            if (!address?.line1)
              throw new Error(
                'Cannot send sale email: address line 1 is missing'
              );
            if (!address?.city)
              throw new Error(
                'Cannot send sale email: shipping city is missing'
              );
            if (!address?.state)
              throw new Error(
                'Cannot send sale email: shipping state is missing'
              );
            if (!address.postal_code)
              throw new Error(
                'Cannot send sale email: shipping postal code is missing'
              );
            if (!address.country)
              throw new Error(
                'Cannot send sale email: shipping country is missing'
              );

            // Order confirmation email
            await sendOrderConfirmationEmail({
              // to: user.email,
              to: 'jay@abandonedhobby.com',
              name: user.firstName,
              creditCardStatement:
                charge.statement_descriptor ?? 'ABANDONED HOBBY',
              creditCardBrand:
                charge.payment_method_details?.card?.brand ?? 'N/A',
              creditCardLast4:
                charge.payment_method_details?.card?.last4 ?? '0000',
              receiptId: order.id,
              orderDate: new Date().toLocaleDateString('en-US'),
              lineItems: receiptLineItems,
              total: `$${(data.amount_total! / 100).toFixed(2)}`,
              support_url:
                process.env.SUPPORT_URL || 'https://abandonedhobby.com/support',
              item_summary: summary
            });

            const rawMeta = expandedSession.metadata ?? {};
            const meta: Partial<CheckoutMetadata> = {
              userId: rawMeta.userId,
              tenantId: rawMeta.tenantId,
              tenantSlug: rawMeta.tenantSlug,
              sellerStripeAccountId: rawMeta.sellerStripeAccountId,
              productIds: rawMeta.productIds
            };

            const metaTenantId = meta.tenantId;
            const metaTenantSlug = meta.tenantSlug;
            const metaSellerAccount = meta.sellerStripeAccountId;

            // Prefer metadata (what you set in the purchase mutation). Fallback to event.account.
            let tenantDoc: TenantWithContact | null = null;

            if (metaTenantId) {
              try {
                tenantDoc = (await payload.findByID({
                  collection: 'tenants',
                  id: metaTenantId,
                  depth: 1,
                  overrideAccess: true // avoid admin UI access rules during webhooks
                })) as TenantWithContact;
              } catch (e) {
                console.warn(
                  '[webhook] tenant findByID by metadata.tenantId failed',
                  e
                );
              }
            }

            if (!tenantDoc && event.account) {
              const tRes = await payload.find({
                collection: 'tenants',
                where: { stripeAccountId: { equals: event.account as string } },
                limit: 1,
                depth: 1,
                overrideAccess: true
              });
              tenantDoc = (tRes.docs[0] ?? null) as TenantWithContact | null;
            }

            if (!tenantDoc) {
              throw new Error(
                `No tenant resolved. meta.tenantId=${metaTenantId} meta.tenantSlug=${metaTenantSlug} event.account=${event.account}`
              );
            }

            if (
              metaSellerAccount &&
              event.account &&
              metaSellerAccount !== event.account
            ) {
              console.warn(
                '[webhook] MISMATCH: event.account != metadata.sellerStripeAccountId',
                {
                  eventAccount: event.account,
                  metaSellerAccount
                }
              );
            }

            // Resolve seller email & name with robust fallbacks
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
              } catch (e) {
                console.warn('[webhook] failed to load primaryContact', {
                  tenantId: tenantDoc.id,
                  err: e instanceof Error ? e.message : String(e)
                });
              }
            } else if (primaryRef && typeof primaryRef === 'object') {
              primaryContactUser = primaryRef as User;
            }

            // --- final seller email & name (typed) ---
            const sellerEmail: string | null =
              tenantDoc.notificationEmail ?? primaryContactUser?.email ?? null;

            const sellerName: string =
              tenantDoc.notificationName ??
              primaryContactUser?.firstName ??
              primaryContactUser?.username ??
              tenantDoc.name ??
              'Seller';

            console.log(
              '[seller email debug]',
              JSON.stringify(
                {
                  eventAccount: event.account,
                  metaTenantId,
                  metaTenantSlug,
                  metaSellerAccount,
                  resolvedTenantId: tenantDoc.id,
                  resolvedTenantSlug: tenantDoc.slug,
                  resolvedTenantName: tenantDoc.name,
                  notificationEmail: tenantDoc.notificationEmail,
                  notificationName: tenantDoc.notificationName,
                  primaryContactIsObject: !!primaryContactUser,
                  primaryContactEmail: primaryContactUser?.email ?? null,
                  primaryContactFirstName:
                    primaryContactUser?.firstName ?? null,
                  finalSellerEmail: sellerEmail,
                  finalSellerName: sellerName
                },
                null,
                2
              )
            );

            if (!sellerEmail) {
              throw new Error(
                `No seller notification email configured for tenant ${tenantDoc.id}`
              );
            }

            await sendSaleNotificationEmail({
              // to: sellerEmail,
              to: 'jay@abandonedhobby.com',
              sellerName, // 👈 camelCase here
              receiptId: order.id,
              orderDate: new Date().toLocaleDateString('en-US'),
              lineItems: receiptLineItems,
              total: `$${(data.amount_total! / 100).toFixed(2)}`,
              item_summary: summary,
              shipping_name: customer.name!, // buyer
              shipping_address_line1: address.line1!,
              shipping_address_line2: address.line2 ?? undefined,
              shipping_city: address.city!,
              shipping_state: address.state!,
              shipping_zip: address.postal_code!,
              shipping_country: address.country!,
              support_url:
                process.env.SUPPORT_URL || 'https://abandonedhobby.com/support'
            });
          }
          break;

        case 'account.updated':
          {
            data = event.data.object as Stripe.Account;
            if (!data) {
              throw new Error('Account data is required');
            }

            await payload.update({
              collection: 'tenants',
              where: {
                stripeAccountId: {
                  equals: data.id
                }
              },
              data: {
                stripeDetailsSubmitted: data.details_submitted
              }
            });
          }
          break;

        default: {
          throw new Error(`Unhandled event: ${event.type}`);
        }
      }
    } catch (error) {
      return NextResponse.json(
        { message: `Webhook handler failed: ${error}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Received' }, { status: 200 });
}
