import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import Stripe from 'stripe';
import crypto from 'node:crypto';

import config from '@payload-config';

import {
  sendOrderConfirmationEmail,
  sendSaleNotificationEmail
} from '@/lib/sendEmail';
import { posthogServer } from '@/lib/server/posthog-server';
import { stripe } from '@/lib/stripe';
import { findExistingOrderBySessionOrEvent } from '@/modules/orders/precheck';
import {
  buildOrderItems,
  earliestReturnsCutoffISO
} from '@/modules/stripe/build-order-items';
import {
  hasProcessed,
  isExpandedLineItem,
  isStringValue,
  itemHasProductId,
  markProcessed,
  requireStripeProductId
} from '@/modules/stripe/guards';
import {
  sumAmountTotalCents,
  buildReceiptLineItems
} from '@/modules/stripe/line-items';
import type { TenantWithContact } from '@/modules/tenants/resolve';
import type { Product, User } from '@/payload-types';

import { OrderItemInput } from './utils/types';
import {
  toQtyMap,
  getProductsModel,
  flushIfNeeded,
  isUniqueViolation,
  tryCall
} from './utils/utils';
import {
  recomputeRefundState,
  toLocalRefundStatus
} from '@/modules/refunds/utils';

export const runtime = 'nodejs';

// Stripe’s expanded line item with expanded product metadata.id guaranteed.
export type ExpandedLineItem = Stripe.LineItem & {
  price: Stripe.Price & {
    product: Stripe.Product & { metadata: Record<string, string> };
  };
};

/* ──────────────────────────────────────────────────────────────────────────────
 * Inventory decrement (atomic) + batch  (Mongo / Mongoose)
 * ────────────────────────────────────────────────────────────────────────────── */

async function decrementProductStockAtomic(
  payloadInstance: import('payload').Payload,
  productId: string,
  quantity: number,
  options: { autoArchive?: boolean } = {}
): Promise<
  | { ok: true; after: { stockQuantity: number }; archived: boolean }
  | {
      ok: false;
      reason: 'not-supported' | 'not-tracked' | 'not-found' | 'insufficient';
    }
> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, reason: 'insufficient' };
  }

  const ProductModel = getProductsModel(payloadInstance);
  if (ProductModel) {
    const updated = await ProductModel.findOneAndUpdate(
      { _id: productId, stockQuantity: { $gte: quantity } },
      { $inc: { stockQuantity: -quantity } },
      { new: true, lean: true }
    );

    if (updated) {
      const afterQuantity =
        typeof updated.stockQuantity === 'number'
          ? updated.stockQuantity
          : null;

      if (afterQuantity == null) {
        return { ok: false, reason: 'not-tracked' };
      }

      let archived = Boolean(updated.isArchived);

      if (options.autoArchive === true && afterQuantity === 0 && !archived) {
        await ProductModel.updateOne(
          { _id: productId, isArchived: { $ne: true } },
          { $set: { isArchived: true } }
        );
        archived = true;
      }

      return { ok: true, after: { stockQuantity: afterQuantity }, archived };
    }
  }

  const productDocument = (await payloadInstance.findByID({
    collection: 'products',
    id: productId,
    depth: 0,
    overrideAccess: true,
    draft: false
  })) as {
    id: string;
    stockQuantity?: number | null;
    isArchived?: boolean | null;
  } | null;

  if (!productDocument) return { ok: false, reason: 'not-found' };

  const currentQuantity =
    typeof productDocument.stockQuantity === 'number'
      ? productDocument.stockQuantity
      : null;

  if (currentQuantity == null) return { ok: false, reason: 'not-tracked' };
  if (currentQuantity < quantity) return { ok: false, reason: 'insufficient' };

  const nextQuantity = currentQuantity - quantity;
  const shouldArchive = options.autoArchive === true && nextQuantity === 0;

  const updated = (await payloadInstance.update({
    collection: 'products',
    id: productId,
    data: {
      stockQuantity: nextQuantity,
      ...(shouldArchive ? { isArchived: true } : {})
    },
    overrideAccess: true,
    draft: false,
    context: { ahSystem: true, ahSkipAutoArchive: true }
  })) as { stockQuantity?: number | null; isArchived?: boolean | null };

  return {
    ok: true,
    after: { stockQuantity: (updated.stockQuantity as number) ?? nextQuantity },
    archived: Boolean(updated.isArchived)
  };
}

async function decrementInventoryBatch(args: {
  payload: import('payload').Payload;
  qtyByProductId: Map<string, number>;
}): Promise<void> {
  const { payload: payloadInstance, qtyByProductId } = args;

  const failures: Array<{ productId: string; reason: string }> = [];
  for (const [productId, purchasedQuantity] of qtyByProductId) {
    let attempts = 0,
      result;
    do {
      attempts++;
      result = await decrementProductStockAtomic(
        payloadInstance,
        productId,
        purchasedQuantity,
        { autoArchive: true }
      );
    } while (!result.ok && attempts < 3 && result.reason === 'insufficient');

    if (result.ok) {
      console.log('[inv] dec-atomic', {
        productId,
        purchasedQty: purchasedQuantity,
        after: result.after,
        archived: result.archived
      });
    } else {
      console.warn('[inv] dec-atomic failed', {
        productId,
        purchasedQty: purchasedQuantity,
        reason: result.reason
      });
      failures.push({ productId, reason: result.reason });
    }
  }
  if (failures.length) {
    // Surface failures to caller for follow-up.
    const detail = failures
      .map((failure) => `${failure.productId}:${failure.reason}`)
      .join(', ');
    console.error(detail);
  }
}

// Toggle emails from an env var. Any of: "1", "true", "yes" will enable.
const WEBHOOK_EMAILS_ENABLED: boolean = /^(1|true|yes)$/i.test(
  process.env.WEBHOOK_EMAILS_ENABLED ?? ''
);

// Choose who receives the seller “sale notification” email.
// Allowed values: 'payout', 'seller' (default), 'both'
type NotificationRouting = 'payout' | 'seller' | 'both';
const NOTIFICATION_ROUTING: NotificationRouting =
  process.env.ORDER_NOTIFICATIONS_TENANT === 'payout'
    ? 'payout'
    : process.env.ORDER_NOTIFICATIONS_TENANT === 'both'
      ? 'both'
      : 'seller';
/**
 * Conditionally executes a provided async action when webhook emails are enabled.
 */
async function sendIfEnabled<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T | null> {
  if (!WEBHOOK_EMAILS_ENABLED) {
    console.log(`[email] skipped (${label}) – WEBHOOK_EMAILS_ENABLED is off`);
    return null;
  }
  return tryCall(label, fn);
}

/**
 * Resolve a normalized shipping address for an order from a Stripe Checkout flow.
 */
function resolveShippingForOrder(args: {
  expanded: Stripe.Checkout.Session;
  paymentIntent: Stripe.PaymentIntent;
  charge: Stripe.Charge;
  buyerFallbackName?: string | null;
}): {
  name?: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
} | null {
  const { expanded, paymentIntent, charge, buyerFallbackName } = args;

  type AddressLike = {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  type ShippingLike = { name?: string | null; address?: AddressLike | null };
  type SessionWithShipping = Stripe.Checkout.Session & {
    collected_information?: { shipping_details?: ShippingLike | null } | null;
    shipping_details?: ShippingLike | null;
    shipping?: ShippingLike | null;
  };

  const sessionWithShipping = expanded as unknown as SessionWithShipping;

  const sessionShipping =
    sessionWithShipping.collected_information?.shipping_details ??
    sessionWithShipping.shipping_details ??
    sessionWithShipping.shipping ??
    null;

  const billing = expanded.customer_details ?? null;

  const paymentIntentShipping =
    (paymentIntent.shipping as unknown as ShippingLike | null) ?? null;
  const chargeShipping =
    (charge.shipping as unknown as ShippingLike | null) ?? null;

  const resolvedName =
    sessionShipping?.name ??
    paymentIntentShipping?.name ??
    chargeShipping?.name ??
    billing?.name ??
    buyerFallbackName ??
    'Customer';

  const address: AddressLike | null =
    sessionShipping?.address ??
    paymentIntentShipping?.address ??
    chargeShipping?.address ??
    billing?.address ??
    null;

  if (!address?.line1) return null;

  return {
    name: resolvedName,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    postalCode: address.postal_code ?? null,
    country: address.country ?? null
  };
}

/**
 * Utility: normalize a relationship id from string or { id }.
 */
function normalizeRelationshipId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'id' in (value as { id?: unknown })
  ) {
    const maybeId = (value as { id?: unknown }).id;
    return typeof maybeId === 'string' ? maybeId : null;
  }
  return null;
}

/**
 * Utility: pick the seller (product) tenant id from the order items.
 */
function getProductTenantIdForOrder(
  items: Array<{ product: string }>,
  productsById: Map<string, Product>
): string {
  for (const item of items) {
    const product = productsById.get(item.product);
    const productTenantId = normalizeRelationshipId(product?.tenant);
    if (productTenantId) return productTenantId;
  }
  throw new Error('Could not resolve a product tenant for the order.');
}

/**
 * Utility: derive an email and display name from a tenant.
 */
async function deriveNotificationContactForTenant(args: {
  payload: import('payload').Payload;
  tenant: TenantWithContact;
}): Promise<{ email: string | null; displayName: string }> {
  const { payload: payloadInstance, tenant } = args;

  const primaryRelationship = tenant.primaryContact;
  let primaryUser: User | null = null;

  if (typeof primaryRelationship === 'string') {
    try {
      primaryUser = (await tryCall('users.findByID(primaryRef)', () =>
        payloadInstance.findByID({
          collection: 'users',
          id: primaryRelationship,
          depth: 0,
          overrideAccess: true
        })
      )) as User | null;
    } catch {
      primaryUser = null;
    }
  } else if (primaryRelationship && typeof primaryRelationship === 'object') {
    primaryUser = primaryRelationship as User;
  }

  const email: string | null =
    tenant.notificationEmail ?? primaryUser?.email ?? null;

  const displayName: string =
    tenant.notificationName ??
    primaryUser?.firstName ??
    (primaryUser ? primaryUser.username : undefined) ??
    tenant.name ??
    'Seller';

  return { email, displayName };
}

/**
 * Handle incoming Stripe webhook POST requests.
 */
export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    const bodyText = await req.text();
    event = stripe.webhooks.constructEvent(
      bodyText,
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
    console.log('[webhook] event', {
      type: event.type,
      id: event.id,
      account: event.account ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Error';
    return NextResponse.json(
      { message: `Webhook error: ${message}` },
      { status: 400 }
    );
  }

  const payloadInstance = await getPayload({ config });

  const permitted = new Set<Stripe.Event.Type>([
    'checkout.session.completed',
    'payment_intent.payment_failed',
    'checkout.session.expired',
    'account.updated',
    'refund.created',
    'refund.updated',
    'charge.refunded'
  ]);
  if (!permitted.has(event.type)) {
    await markProcessed(payloadInstance, event.id);
    return NextResponse.json({ message: 'Ignored' }, { status: 200 });
  }

  try {
    try {
      if (await hasProcessed(payloadInstance, event.id)) {
        return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
      }
    } catch (dedupeError) {
      console.warn('[webhook] dedupe check failed (continuing):', dedupeError);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        if (!userId) throw new Error('User ID is required');
        if (!event.account)
          throw new Error('Stripe account ID is required for order creation');

        const accountId: string = event.account;

        const user = (await tryCall('users.findByID', () =>
          payloadInstance.findByID({
            collection: 'users',
            id: userId,
            depth: 0,
            overrideAccess: true
          })
        )) as User | null;
        if (!user) throw new Error('User is required');

        const existing = await tryCall('orders.fast-precheck', () =>
          findExistingOrderBySessionOrEvent(
            payloadInstance,
            session.id,
            event.id
          )
        );

        if (existing) {
          console.log('[webhook] dup-precheck hit (before)', {
            orderId: existing.id,
            hasItems: Array.isArray(existing.items),
            itemsCount: Array.isArray(existing.items)
              ? existing.items.length
              : 0,
            inventoryAdjustedAt: existing.inventoryAdjustedAt ?? null
          });

          if (!existing.inventoryAdjustedAt && Array.isArray(existing.items)) {
            const quantityByProductId = toQtyMap(
              existing.items
                .map((item) => {
                  const rel = item.product as unknown;
                  const product =
                    typeof rel === 'string'
                      ? rel
                      : rel && typeof rel === 'object' && 'id' in rel
                        ? String((rel as { id?: string }).id)
                        : null;
                  if (!product) return null;
                  return {
                    product,
                    quantity:
                      typeof item.quantity === 'number' ? item.quantity : 1
                  };
                })
                .filter(Boolean) as Array<{ product: string; quantity: number }>
            );

            console.log('[webhook] decrement on duplicate path', {
              entries: [...quantityByProductId.entries()]
            });

            await tryCall('inventory.decrementBatch(dup)', () =>
              decrementInventoryBatch({
                payload: payloadInstance,
                qtyByProductId: quantityByProductId
              })
            );

            await tryCall('orders.update(inventoryAdjustedAt, dup)', () =>
              payloadInstance.update({
                collection: 'orders',
                id: existing.id,
                data: {
                  inventoryAdjustedAt: new Date().toISOString(),
                  stripeEventId: event.id
                },
                overrideAccess: true
              })
            );

            console.log('[webhook] inventory adjusted on duplicate path', {
              orderId: existing.id
            });
          } else {
            console.log(
              '[webhook] duplicate path: inventory already adjusted',
              {
                orderId: existing.id
              }
            );
          }

          await markProcessed(payloadInstance, event.id);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const expandedSession = await tryCall(
          'stripe.sessions.retrieve(expanded)',
          () =>
            stripe.checkout.sessions.retrieve(
              session.id,
              {
                expand: [
                  'line_items.data.price.product',
                  'shipping',
                  'customer_details'
                ]
              },
              { stripeAccount: accountId }
            )
        );

        const rawLineItems = (expandedSession.line_items?.data ??
          []) as Stripe.LineItem[];
        if (rawLineItems.length === 0) throw new Error('No line items found');

        let totalAmountInCents = sumAmountTotalCents(rawLineItems);

        const expandedLineItems = rawLineItems.filter(isExpandedLineItem);
        if (expandedLineItems.length === 0) {
          throw new Error('No expanded line items with product metadata');
        }

        const receiptLineItems = buildReceiptLineItems(expandedLineItems);

        const paymentIntent = await tryCall(
          'stripe.paymentIntents.retrieve',
          () =>
            stripe.paymentIntents.retrieve(
              expandedSession.payment_intent as string,
              { expand: ['charges.data.payment_method_details'] },
              { stripeAccount: accountId }
            )
        );
        const chargeId = paymentIntent.latest_charge;
        if (!chargeId) throw new Error('No charge found on paymentIntent');

        const charge = await tryCall('stripe.charges.retrieve', () =>
          stripe.charges.retrieve(chargeId as string, {
            stripeAccount: accountId
          })
        );

        if (
          totalAmountInCents <= 0 &&
          typeof paymentIntent.amount_received === 'number'
        ) {
          totalAmountInCents = paymentIntent.amount_received;
        }

        const metadata = (expandedSession.metadata ?? {}) as Record<
          string,
          string
        >;
        let payoutTenantDocument: TenantWithContact | null = null;

        const tenantIdFromMetadata = metadata.tenantId;
        if (tenantIdFromMetadata) {
          try {
            payoutTenantDocument = (await tryCall(
              'tenants.findByID(meta.tenantId)',
              () =>
                payloadInstance.findByID({
                  collection: 'tenants',
                  id: tenantIdFromMetadata,
                  depth: 1,
                  overrideAccess: true
                })
            )) as TenantWithContact | null;
          } catch {
            payoutTenantDocument = null;
          }
        }

        if (!payoutTenantDocument && event.account) {
          const tenantLookup = await tryCall(
            'tenants.find(stripeAccountId)',
            () =>
              payloadInstance.find({
                collection: 'tenants',
                where: { stripeAccountId: { equals: accountId } },
                limit: 1,
                depth: 1,
                overrideAccess: true
              })
          );
          payoutTenantDocument =
            ((tenantLookup.docs[0] ?? null) as TenantWithContact | null) ??
            null;
        }

        if (!payoutTenantDocument) {
          throw new Error(
            `No tenant resolved. meta.tenantId=${tenantIdFromMetadata ?? 'null'} event.account=${event.account}`
          );
        }

        if (
          isStringValue(metadata.sellerStripeAccountId) &&
          isStringValue(event.account) &&
          metadata.sellerStripeAccountId !== event.account
        ) {
          console.warn(
            '[webhook] MISMATCH: event.account != metadata.sellerStripeAccountId',
            {
              eventAccount: event.account,
              metaSellerAccount: metadata.sellerStripeAccountId
            }
          );
        }

        const productIds = expandedLineItems.map((l) =>
          requireStripeProductId(l)
        );
        const productsResult =
          productIds.length > 0
            ? await tryCall('products.findByIds', () =>
                payloadInstance.find({
                  collection: 'products',
                  where: { id: { in: productIds } },
                  depth: 0,
                  overrideAccess: true
                })
              )
            : { docs: [] as Product[] };

        const productById = new Map<string, Product>(
          (productsResult.docs as Product[]).map((p) => [p.id, p])
        );

        const orderItems: OrderItemInput[] = buildOrderItems(
          expandedLineItems,
          productById
        );
        const returnsAcceptedThroughISO = earliestReturnsCutoffISO(orderItems);

        const firstProductId = orderItems.find(itemHasProductId)?.product;
        if (!firstProductId) {
          throw new Error('No product id resolved from Stripe line items.');
        }

        const currencyCode = (expandedSession.currency ?? 'USD').toUpperCase();
        const orderNumber = `AH-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const firstItemName = orderItems[0]?.nameSnapshot ?? 'Order';
        const orderDisplayName =
          orderItems.length > 1
            ? `${firstItemName} (+${orderItems.length - 1} more)`
            : firstItemName;

        const shippingGroup = resolveShippingForOrder({
          expanded: expandedSession,
          paymentIntent,
          charge,
          buyerFallbackName: user.firstName
        });

        // Resolve tenants for ownership vs payout
        const productTenantId = getProductTenantIdForOrder(
          orderItems,
          productById
        );

        // Optional guard: ensure single-tenant cart
        const mismatchedProductIds = orderItems
          .map((item) => item.product)
          .filter((productId) => {
            const product = productById.get(productId);
            const productTenantIdCurrent = normalizeRelationshipId(
              product?.tenant
            );
            return (
              !productTenantIdCurrent ||
              productTenantIdCurrent !== productTenantId
            );
          });

        if (mismatchedProductIds.length > 0) {
          const detail = mismatchedProductIds
            .map((id) => `${id}:${productById.get(id)?.name ?? 'Unknown'}`)
            .join(', ');
          throw new Error(
            `Order contains items from multiple tenants. Expected ${productTenantId}, mismatches: ${detail}`
          );
        }

        // Create order
        let orderDocumentId: string;

        console.log('[webhook] creating order with', {
          sellerTenantId: productTenantId,
          eventAccount: event.account,
          sessionMetaTenantId: (expandedSession.metadata ?? {}).tenantId ?? null
        });

        try {
          const created = await tryCall('orders.create', () =>
            payloadInstance.create({
              collection: 'orders',
              data: {
                name: orderDisplayName,
                orderNumber,
                buyer: user.id,
                sellerTenant: productTenantId, // seller/storefront tenant
                currency: currencyCode,
                product: firstProductId, // legacy back-compat
                stripeAccountId: accountId,
                stripeCheckoutSessionId: session.id,
                stripeEventId: event.id,
                stripePaymentIntentId: paymentIntent.id,
                stripeChargeId: charge.id,
                items: orderItems,
                returnsAcceptedThrough: returnsAcceptedThroughISO,
                buyerEmail:
                  expandedSession.customer_details?.email ?? undefined,
                status: 'paid',
                fulfillmentStatus: 'unfulfilled',
                total: totalAmountInCents,
                ...(shippingGroup ? { shipping: shippingGroup } : {})
              },
              overrideAccess: true
            })
          );
          orderDocumentId = String(created.id);
        } catch (createError) {
          if (isUniqueViolation(createError)) {
            console.log(
              '[webhook] duplicate detected (unique-violation catch)',
              { sessionId: session.id, eventId: event.id }
            );
            await markProcessed(payloadInstance, event.id);
            return NextResponse.json({ received: true }, { status: 200 });
          }
          throw createError;
        }

        // Inventory adjustments
        const quantityByProductId = toQtyMap(
          orderItems.map((item) => ({
            product: item.product,
            quantity: item.quantity
          }))
        );
        await tryCall('inventory.decrementBatch(primary)', () =>
          decrementInventoryBatch({
            payload: payloadInstance,
            qtyByProductId: quantityByProductId
          })
        );

        await tryCall('orders.update(inventoryAdjustedAt)', () =>
          payloadInstance.update({
            collection: 'orders',
            id: orderDocumentId,
            data: { inventoryAdjustedAt: new Date().toISOString() },
            overrideAccess: true
          })
        );

        // -----------------------
        // Email notifications
        // -----------------------
        const lineItemSummary = receiptLineItems
          .map((item) => item.description)
          .join(', ');

        // Try to resolve shipping, but do not block emails if it is missing
        const shippingResolved = shippingGroup;

        // Buyer email (prefer user.email, then Stripe customer_details.email)
        const buyerEmailAddress: string | null =
          (typeof user.email === 'string' && user.email.length > 0
            ? user.email
            : null) ??
          (typeof expandedSession.customer_details?.email === 'string' &&
          expandedSession.customer_details?.email.length > 0
            ? expandedSession.customer_details.email
            : null);

        console.log('[email] config', {
          enabled: WEBHOOK_EMAILS_ENABLED,
          routingMode:
            process.env.ORDER_NOTIFICATIONS_TENANT ?? 'seller(default)',
          buyerEmailPresent: Boolean(buyerEmailAddress)
        });

        // Send the customer confirmation email (best effort)
        if (buyerEmailAddress) {
          await sendIfEnabled('email.sendOrderConfirmation', () =>
            sendOrderConfirmationEmail({
              to: buyerEmailAddress,
              name: user.firstName,
              creditCardStatement:
                charge.statement_descriptor ?? 'ABANDONED HOBBY',
              creditCardBrand:
                charge.payment_method_details?.card?.brand ?? 'N/A',
              creditCardLast4:
                charge.payment_method_details?.card?.last4 ?? '0000',
              receiptId: orderDocumentId,
              orderDate: new Date().toLocaleDateString('en-US'),
              lineItems: receiptLineItems,
              total: `$${(totalAmountInCents / 100).toFixed(2)}`,
              support_url:
                process.env.SUPPORT_URL || 'https://abandonedhobby.com/support',
              item_summary: lineItemSummary
            })
          );
        } else {
          console.warn(
            '[email] customer confirmation skipped: no buyer email resolved'
          );
        }

        // Resolve seller and payout tenant documents for notification routing
        const sellerTenantDocument = (await tryCall(
          'tenants.findByID(seller)',
          () =>
            payloadInstance.findByID({
              collection: 'tenants',
              id: productTenantId,
              depth: 1,
              overrideAccess: true
            })
        )) as TenantWithContact;

        // Build the unique recipient set based on routing mode
        const recipientEmails = new Set<string>();
        const recipientNameByEmail = new Map<string, string>();

        async function addRecipientFromTenant(
          tenantDocument: TenantWithContact
        ): Promise<void> {
          const contact = await deriveNotificationContactForTenant({
            payload: payloadInstance,
            tenant: tenantDocument
          });
          if (contact.email) {
            recipientEmails.add(contact.email);
            recipientNameByEmail.set(contact.email, contact.displayName);
          } else {
            console.warn(
              '[email] seller notification skipped: tenant has no email',
              {
                tenantId: tenantDocument.id,
                tenantName: tenantDocument.name
              }
            );
          }
        }

        if (NOTIFICATION_ROUTING === 'payout') {
          await addRecipientFromTenant(payoutTenantDocument);
        } else if (NOTIFICATION_ROUTING === 'seller') {
          await addRecipientFromTenant(sellerTenantDocument);
        } else {
          await addRecipientFromTenant(payoutTenantDocument);
          await addRecipientFromTenant(sellerTenantDocument);
        }

        // Send seller notification(s) even if shipping is partial or missing
        for (const recipientEmail of recipientEmails) {
          const recipientDisplayName =
            recipientNameByEmail.get(recipientEmail) ?? 'Seller';

          await sendIfEnabled('email.sendSaleNotification', () =>
            sendSaleNotificationEmail({
              to: recipientEmail,
              sellerName: recipientDisplayName,
              receiptId: orderDocumentId,
              orderDate: new Date().toLocaleDateString('en-US'),
              lineItems: receiptLineItems,
              total: `$${(totalAmountInCents / 100).toFixed(2)}`,
              item_summary: lineItemSummary,
              // shipping fields are optional now; pass empty strings if missing
              shipping_name:
                shippingResolved?.name ?? user.firstName ?? 'Customer',
              shipping_address_line1: shippingResolved?.line1 ?? '',
              shipping_address_line2: shippingResolved?.line2 ?? undefined,
              shipping_city: shippingResolved?.city ?? '',
              shipping_state: shippingResolved?.state ?? '',
              shipping_zip: shippingResolved?.postalCode ?? '',
              shipping_country: shippingResolved?.country ?? '',
              support_url:
                process.env.SUPPORT_URL || 'https://abandonedhobby.com/support'
            })
          );
        }

        // Analytics (best-effort)
        try {
          posthogServer?.capture({
            distinctId: user.id ?? 'unknown',
            event: 'purchaseCompleted',
            properties: {
              stripeSessionId: session.id,
              amountTotal: totalAmountInCents,
              currency: currencyCode,
              productIdsFromLines: productIds,
              tenantId: payoutTenantDocument.id,
              $insert_id: `purchase:${session.id}`
            },
            groups: payoutTenantDocument.id
              ? { tenant: payoutTenantDocument.id }
              : undefined
          });

          await flushIfNeeded();
        } catch (analyticsError) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[analytics] purchaseCompleted capture failed:',
              analyticsError
            );
          }
        }

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const metadata = (paymentIntent.metadata ?? {}) as Record<
          string,
          string
        >;
        const buyerId = metadata.userId ?? metadata.buyerId ?? 'anonymous';
        const tenantId = metadata.tenantId;
        const tenantSlug = metadata.tenantSlug;
        const productIds =
          typeof metadata.productIds === 'string' && metadata.productIds.length
            ? metadata.productIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((id, index, self) => self.indexOf(id) === index)
            : undefined;

        try {
          posthogServer?.capture({
            distinctId: buyerId,
            event: 'checkoutFailed',
            properties: {
              stripePaymentIntentId: paymentIntent.id,
              failureCode: paymentIntent.last_payment_error?.code,
              failureMessage: paymentIntent.last_payment_error?.message,
              tenantId,
              tenantSlug,
              productIds,
              $insert_id: event.id
            },
            groups: tenantId ? { tenant: tenantId } : undefined,
            timestamp: new Date(event.created * 1000)
          });

          await flushIfNeeded();
        } catch (analyticsError) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[analytics] checkoutFailed capture failed:',
              analyticsError
            );
          }
        }

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;

        const metadata = (session.metadata ?? {}) as Record<string, string>;
        const buyerId = metadata.userId ?? metadata.buyerId ?? 'anonymous';
        const tenantId = metadata.tenantId;
        const tenantSlug = metadata.tenantSlug;
        const productIds =
          typeof metadata.productIds === 'string' && metadata.productIds.length
            ? metadata.productIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((id, index, self) => self.indexOf(id) === index)
            : undefined;

        try {
          posthogServer?.capture({
            distinctId: buyerId,
            event: 'checkoutFailed',
            properties: {
              reason: 'expired',
              productIds,
              tenantId,
              tenantSlug,
              stripeSessionId: session.id,
              expiresAt: session.expires_at
                ? new Date(session.expires_at * 1000).toISOString()
                : undefined,
              $insert_id: event.id
            },
            groups: tenantId ? { tenant: tenantId } : undefined,
            timestamp: new Date(event.created * 1000)
          });

          await flushIfNeeded();
        } catch (analyticsError) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[analytics] checkoutFailed(expired) capture failed:',
              analyticsError
            );
          }
        }

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await tryCall('tenants.update(stripeDetailsSubmitted)', () =>
          payloadInstance.update({
            collection: 'tenants',
            where: { stripeAccountId: { equals: account.id } },
            data: { stripeDetailsSubmitted: account.details_submitted },
            overrideAccess: true
          })
        );

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ updated: true }, { status: 200 });
      }

      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund;

        try {
          await payloadInstance.update({
            collection: 'refunds',
            where: { stripeRefundId: { equals: refund.id } },
            data: { status: toLocalRefundStatus(refund.status) },
            overrideAccess: true
          });
        } catch {
          // ok if no local row
        }

        const orderIdForRefund = await resolveOrderIdForRefund({
          payload: payloadInstance,
          rf: refund
        });
        if (orderIdForRefund) {
          await recomputeRefundState({
            payload: payloadInstance,
            orderId: orderIdForRefund,
            includePending: true
          });
        }

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      case 'refund.created': {
        const refund = event.data.object as Stripe.Refund;

        try {
          await payloadInstance.update({
            collection: 'refunds',
            where: { stripeRefundId: { equals: refund.id } },
            data: { status: toLocalRefundStatus(refund.status) },
            overrideAccess: true
          });
        } catch (syncError) {
          console.warn('[webhook] failed to sync refund row', syncError);
        }

        const orderIdForRefund = await resolveOrderIdForRefund({
          payload: payloadInstance,
          rf: refund
        });

        if (orderIdForRefund) {
          await recomputeRefundState({
            payload: payloadInstance,
            orderId: orderIdForRefund,
            includePending: true
          });
        }

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;

        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : null;

        const refundLike = {
          id: `charge:${charge.id}`,
          payment_intent: paymentIntentId ?? undefined,
          charge: charge.id
        } as unknown as Stripe.Refund;

        const orderIdForRefund = await resolveOrderIdForRefund({
          payload: payloadInstance,
          rf: refundLike
        });
        if (orderIdForRefund) {
          await recomputeRefundState({
            payload: payloadInstance,
            orderId: orderIdForRefund,
            includePending: true
          });
        }

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ ok: true }, { status: 200 });
      }
    }
  } catch (handlerError) {
    const message =
      handlerError instanceof Error
        ? handlerError.message
        : String(handlerError);
    const asError = handlerError as Error;
    console.error('Webhook handler failed:', message);
    if (asError.stack) console.error('Error stack: ', asError.stack);

    const status = process.env.NODE_ENV === 'production' ? 500 : 200;
    if (status === 200) {
      await markProcessed(payloadInstance, event.id);
    }
    return NextResponse.json(
      { message: `Webhook handler failed: ${message}` },
      { status }
    );
  }

  // ------------- helpers inside POST -------------
  async function resolveOrderIdForRefund(args: {
    payload: import('payload').Payload;
    rf: Stripe.Refund;
  }): Promise<string | null> {
    const { payload: payloadInstanceLocal, rf } = args;

    {
      const list = await payloadInstanceLocal.find({
        collection: 'refunds',
        where: { stripeRefundId: { equals: rf.id } },
        depth: 0,
        limit: 1,
        overrideAccess: true
      });

      const document = list.docs[0];
      if (document) {
        const relation = document.order as
          | string
          | { id?: string }
          | null
          | undefined;
        const orderId = normalizeRelationshipId(relation as unknown);
        if (orderId) return orderId;
      }
    }

    const paymentIntentId =
      typeof rf.payment_intent === 'string' ? rf.payment_intent : null;
    const chargeId = typeof rf.charge === 'string' ? rf.charge : null;

    if (paymentIntentId) {
      const ordersByPaymentIntent = await payloadInstanceLocal.find({
        collection: 'orders',
        where: { stripePaymentIntentId: { equals: paymentIntentId } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      if (ordersByPaymentIntent.docs[0]?.id)
        return String(ordersByPaymentIntent.docs[0].id);
    }

    if (chargeId) {
      const ordersByCharge = await payloadInstanceLocal.find({
        collection: 'orders',
        where: { stripeChargeId: { equals: chargeId } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      if (ordersByCharge.docs[0]?.id) return String(ordersByCharge.docs[0].id);
    }

    console.warn('[webhook] resolveOrderIdForRefund failed', {
      refundId: rf.id,
      paymentIntent: paymentIntentId,
      charge: chargeId
    });

    return null;
  }
}
