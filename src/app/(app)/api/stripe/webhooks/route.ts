import Stripe from 'stripe';
import { getPayload } from 'payload';
import config from '@payload-config';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { ExpandedLineItem } from '@/modules/checkout/types';

export async function POST(req: Request) {
  let event: Stripe.Event;

  console.log('👀 Webhook route hit');

  try {
    event = stripe.webhooks.constructEvent(
      await (await req.blob()).text(),
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
    console.log('📬 Received event type:', event?.type);
    console.log(
      '📦 Event payload:',
      JSON.stringify(event?.data?.object, null, 2)
    );
    console.log('🏦 Connected account ID:', event?.account);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown Error';
    if (error! instanceof Error) {
      console.log(error);
    }
    console.log(`❌ Error message: ${errorMessage}`);
    return NextResponse.json(
      { message: `Webhook error: ${errorMessage}` },
      { status: 400 }
    );
  }

  console.log('✅ Success: ', event.id);

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
            throw new Error('Stripe account ID is required for order creation');
          }
          const expandedSession = await stripe.checkout.sessions.retrieve(
            data.id,
            {
              expand: ['line_items.data.price.product']
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

          for (const item of lineItems) {
            const order = await payload.create({
              collection: 'orders',
              data: {
                stripeCheckoutSessionId: data.id,
                stripeAccountId: event.account,
                user: user.id,
                product: item.price.product.metadata.id,
                name: item.price.product.name
              }
            });
            console.log('✅ Created order:', order.id);
          }

          break;
        case 'account.updated':
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
          break;

        default:
          throw new Error(`Unhandled event: ${event.type}`);
      }
    } catch (error) {
      return NextResponse.json(
        { message: `Webhook handler failed: ${error}` },
        { status: 500 }
      );
    }
  }
  // always have to return something for the webhook.
  return NextResponse.json({ message: 'Received' }, { status: 200 });
}
