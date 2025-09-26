import { NextResponse } from 'next/server';

import { getPayload } from 'payload';

import config from '@payload-config';

import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { posthogServer } from '@/lib/server/posthog-server';
import {
  sendOrderConfirmationEmail,
  sendSaleNotificationEmail
} from '@/lib/sendEmail';

import type { Product, User } from '@/payload-types';
import type { TenantWithContact } from '@/modules/tenants/resolve';
import type { ProductModelLite, PayloadMongoLike } from './utils/types';

import { OrderItemInput } from './utils/types';

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

import {
  buildOrderItems,
  earliestReturnsCutoffISO
} from '@/modules/stripe/build-order-items';

import { findExistingOrderBySessionOrEvent } from '@/modules/orders/precheck';

import { toQtyMap, flushIfNeeded, isUniqueViolation } from './utils/utils';

export const runtime = 'nodejs';

/* ──────────────────────────────────────────────────────────────────────────────
 * Small logging wrapper
 * ────────────────────────────────────────────────────────────────────────────── */
async function tryCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e as Error;
    console.error(`[WEBHOOK ERROR @ ${label}]`, err.message);
    if (err.stack) console.error(err.stack);
    throw e;
  }
}

// Local types

// Stripe’s expanded line item with expanded product metadata.id guaranteed.
export type ExpandedLineItem = Stripe.LineItem & {
  price: Stripe.Price & {
    product: Stripe.Product & { metadata: Record<string, string> };
  };
};

function getProductsModel(
  payload: import('payload').Payload
): ProductModelLite | null {
  const maybeDb = (payload as unknown as PayloadMongoLike).db;
  const collections = maybeDb?.collections;
  const productsUnknown = collections?.products as unknown;

  const maybeModel =
    productsUnknown &&
    ((productsUnknown as { Model?: unknown }).Model as unknown);
  const model = maybeModel as Partial<ProductModelLite> | undefined;

  if (
    model &&
    typeof model.findOneAndUpdate === 'function' &&
    typeof model.updateOne === 'function'
  ) {
    return model as ProductModelLite;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Inventory decrement (atomic) + batch  (Mongo / Mongoose)
 * NOTE:
 * - Uses a single conditional findOneAndUpdate with $inc and stockQuantity >= qty
 *   so concurrent handlers cannot oversell.
 * - If stock hits 0 and autoArchive=true, we immediately set isArchived in a
 *   second, quick update. This isn't “atomic with the decrement”, but it’s safe:
 *   once stock is 0, archiving is idempotent and can’t cause oversell.
 * - This path bypasses Payload hooks (it updates via the underlying Mongoose
 *   Model), which also avoids re-entrancy issues. Keep your product hooks in mind.
 * ────────────────────────────────────────────────────────────────────────────── */

export async function decProductStockAtomic(
  payload: import('payload').Payload,
  productId: string,
  qty: number,
  opts: { autoArchive?: boolean } = {}
): Promise<
  | { ok: true; after: { stockQuantity: number }; archived: boolean }
  | {
      ok: false;
      reason: 'not-supported' | 'not-tracked' | 'not-found' | 'insufficient';
    }
> {
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, reason: 'insufficient' };
  }

  // 1) Preferred: atomic Mongo update via underlying model (if available)
  const ProductModel = getProductsModel(payload);
  if (ProductModel) {
    const updated = await ProductModel.findOneAndUpdate(
      { _id: productId, stockQuantity: { $gte: qty } },
      { $inc: { stockQuantity: -qty } },
      { new: true, lean: true }
    );

    if (updated) {
      const afterQty =
        typeof updated.stockQuantity === 'number'
          ? updated.stockQuantity
          : null;

      if (afterQty == null) {
        return { ok: false, reason: 'not-tracked' };
      }

      let archived = Boolean(updated.isArchived);

      if (opts.autoArchive === true && afterQty === 0 && !archived) {
        await ProductModel.updateOne(
          { _id: productId, isArchived: { $ne: true } },
          { $set: { isArchived: true } }
        );
        archived = true;
      }

      return { ok: true, after: { stockQuantity: afterQty }, archived };
    }

    // If model exists but no doc matched, it’s either not found or insufficient stock.
    // We can’t easily distinguish without another read. Fall through to fallback which
    // will give us a precise reason.
  }

  // 2) Fallback: Payload read-modify-write (ensures decrement still happens)
  //    (Not fully race-proof, but guarantees behavior when Model path isn’t available.)
  const prod = (await payload.findByID({
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

  if (!prod) return { ok: false, reason: 'not-found' };

  const current =
    typeof prod.stockQuantity === 'number' ? prod.stockQuantity : null;

  if (current == null) return { ok: false, reason: 'not-tracked' };
  if (current < qty) return { ok: false, reason: 'insufficient' };

  const next = current - qty;
  const shouldArchive = opts.autoArchive === true && next === 0;

  const updated = (await payload.update({
    collection: 'products',
    id: productId,
    data: {
      stockQuantity: next,
      ...(shouldArchive ? { isArchived: true } : {})
    },
    overrideAccess: true,
    draft: false,
    context: { ahSystem: true, ahSkipAutoArchive: true }
  })) as { stockQuantity?: number | null; isArchived?: boolean | null };

  return {
    ok: true,
    after: { stockQuantity: (updated.stockQuantity as number) ?? next },
    archived: Boolean(updated.isArchived)
  };
}

export async function decrementInventoryBatch(args: {
  payload: import('payload').Payload;
  qtyByProductId: Map<string, number>;
}): Promise<void> {
  const { payload, qtyByProductId } = args;

  for (const [productId, purchasedQty] of qtyByProductId) {
    const res = await decProductStockAtomic(payload, productId, purchasedQty, {
      autoArchive: true
    });

    if (res.ok) {
      console.log('[inv] dec-atomic', {
        productId,
        purchasedQty,
        after: res.after,
        archived: res.archived
      });
    } else {
      console.warn('[inv] dec-atomic failed', {
        productId,
        purchasedQty,
        reason: res.reason
      });
      // Optional: flag order for manual review on 'insufficient' etc.
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Route handler
 * ────────────────────────────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    // IMPORTANT: use raw body for signature verification
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

  const payload = await getPayload({ config });

  // Only handle the small set we care about
  const permitted = new Set<Stripe.Event.Type>([
    'checkout.session.completed',
    'payment_intent.payment_failed',
    'checkout.session.expired',
    'account.updated'
  ]);
  if (!permitted.has(event.type)) {
    // mark processed so retries don't ping us forever (optional)
    await markProcessed(payload, event.id);
    return NextResponse.json({ message: 'Ignored' }, { status: 200 });
  }

  // Global dedupe (across restarts/retries)
  try {
    if (await hasProcessed(payload, event.id)) {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }
  } catch (err) {
    console.warn('[webhook] dedupe check failed (continuing):', err);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Guards
        const userId = session.metadata?.userId;
        if (!userId) throw new Error('User ID is required');
        if (!event.account)
          throw new Error('Stripe account ID is required for order creation');

        // Capture a strictly-typed account id for the rest of this handler
        const accountId: string = event.account;

        // Buyer
        const user = (await tryCall('users.findByID', () =>
          payload.findByID({
            collection: 'users',
            id: userId
          })
        )) as User | null;
        if (!user) throw new Error('User is required');

        // Fast pre-check by session/event
        const existing = await tryCall('orders.fast-precheck', () =>
          findExistingOrderBySessionOrEvent(payload, session.id, event.id)
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
            const qtyByProductId = toQtyMap(
              existing.items
                .filter((i) => typeof i.product === 'string')
                .map((i) => ({
                  product: i.product as string,
                  quantity: typeof i.quantity === 'number' ? i.quantity : 1
                }))
            );

            console.log('[webhook] decrement on duplicate path', {
              entries: [...qtyByProductId.entries()]
            });

            await tryCall('inventory.decrementBatch(dup)', () =>
              decrementInventoryBatch({ payload, qtyByProductId })
            );

            await tryCall('orders.update(inventoryAdjustedAt, dup)', () =>
              payload.update({
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

          await markProcessed(payload, event.id);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // Fetch expanded session (from connected account)
        const expanded = await tryCall(
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

        const rawLines = (expanded.line_items?.data ?? []) as Stripe.LineItem[];
        if (rawLines.length === 0) throw new Error('No line items found');

        // totals that don't require product metadata
        let totalCents = sumAmountTotalCents(rawLines);

        // Narrow to expanded lines with product metadata.id
        const lines = rawLines.filter(isExpandedLineItem);
        if (lines.length === 0) {
          throw new Error('No expanded line items with product metadata');
        }

        const receiptLineItems = buildReceiptLineItems(lines);

        // Payment details
        const paymentIntent = await tryCall(
          'stripe.paymentIntents.retrieve',
          () =>
            stripe.paymentIntents.retrieve(
              expanded.payment_intent as string,
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

        if (!totalCents && typeof paymentIntent.amount_received === 'number') {
          totalCents = paymentIntent.amount_received;
        }

        // Resolve tenant (metadata first, then account)
        const meta = (expanded.metadata ?? {}) as Record<string, string>;
        let tenantDoc: TenantWithContact | null = null;

        const tenantIdFromMeta = meta.tenantId;
        if (tenantIdFromMeta) {
          try {
            tenantDoc = (await tryCall('tenants.findByID(meta.tenantId)', () =>
              payload.findByID({
                collection: 'tenants',
                id: tenantIdFromMeta,
                depth: 1,
                overrideAccess: true
              })
            )) as TenantWithContact | null;
          } catch {
            tenantDoc = null;
          }
        }

        if (!tenantDoc && event.account) {
          const lookup = await tryCall('tenants.find(stripeAccountId)', () =>
            payload.find({
              collection: 'tenants',
              where: { stripeAccountId: { equals: accountId } },
              limit: 1,
              depth: 1,
              overrideAccess: true
            })
          );
          tenantDoc =
            ((lookup.docs[0] ?? null) as TenantWithContact | null) ?? null;
        }

        if (!tenantDoc) {
          throw new Error(
            `No tenant resolved. meta.tenantId=${tenantIdFromMeta ?? 'null'} event.account=${event.account}`
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

        // Preload products (for refund policy → returns window)
        const productIds = lines.map((l) => requireStripeProductId(l));
        const productsRes =
          productIds.length > 0
            ? await tryCall('products.findByIds', () =>
                payload.find({
                  collection: 'products',
                  where: { id: { in: productIds } },
                  depth: 0,
                  overrideAccess: true
                })
              )
            : { docs: [] as Product[] };

        const productMap = new Map<string, Product>(
          (productsRes.docs as Product[]).map((p) => [p.id, p])
        );

        const orderItems: OrderItemInput[] = buildOrderItems(lines, productMap);
        const returnsAcceptedThroughISO = earliestReturnsCutoffISO(orderItems);

        const firstProductId = orderItems.find(itemHasProductId)?.product;
        if (!firstProductId) {
          throw new Error('No product id resolved from Stripe line items.');
        }

        const currency = (expanded.currency ?? 'USD').toUpperCase();
        const orderNumber = `AH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        const firstName = orderItems[0]?.nameSnapshot ?? 'Order';
        const orderName =
          orderItems.length > 1
            ? `${firstName} (+${orderItems.length - 1} more)`
            : firstName;

        // Create order (idempotent via unique session id; catch unique violation)
        let orderDocId: string;
        try {
          const created = await tryCall('orders.create', () =>
            payload.create({
              collection: 'orders',
              data: {
                name: orderName,
                orderNumber,
                buyer: user.id,
                sellerTenant: tenantDoc.id,
                currency,
                product: firstProductId, // legacy back-compat
                stripeAccountId: accountId,
                stripeCheckoutSessionId: session.id,
                stripeEventId: event.id,
                stripePaymentIntentId: paymentIntent.id,
                stripeChargeId: charge.id,
                items: orderItems,
                returnsAcceptedThrough: returnsAcceptedThroughISO,
                buyerEmail: expanded.customer_details?.email ?? undefined,
                status: 'paid',
                total: totalCents,
                shipping: {
                  name: expanded.customer_details?.name ?? 'Customer',
                  line1: expanded.customer_details?.address?.line1,
                  line2: expanded.customer_details?.address?.line2 ?? undefined,
                  city: expanded.customer_details?.address?.city ?? undefined,
                  state: expanded.customer_details?.address?.state ?? undefined,
                  postalCode:
                    expanded.customer_details?.address?.postal_code ??
                    undefined,
                  country:
                    expanded.customer_details?.address?.country ?? undefined
                }
              },
              overrideAccess: true
            })
          );
          orderDocId = String(created.id);
        } catch (err) {
          if (isUniqueViolation(err)) {
            console.log(
              '[webhook] duplicate detected (unique-violation catch)',
              { sessionId: session.id, eventId: event.id }
            );
            await markProcessed(payload, event.id);
            return NextResponse.json({ received: true }, { status: 200 });
          }
          throw err;
        }

        // Inventory
        const qtyByProductId = toQtyMap(
          orderItems.map((i) => ({ product: i.product, quantity: i.quantity }))
        );
        await tryCall('inventory.decrementBatch(primary)', () =>
          decrementInventoryBatch({ payload, qtyByProductId })
        );

        await tryCall('orders.update(inventoryAdjustedAt)', () =>
          payload.update({
            collection: 'orders',
            id: orderDocId,
            data: { inventoryAdjustedAt: new Date().toISOString() },
            overrideAccess: true
          })
        );

        // Emails
        const summary = receiptLineItems.map((i) => i.description).join(', ');

        const customer = expanded.customer_details;
        if (!customer) throw new Error('Missing customer details');
        const address = customer.address;
        if (!customer.name)
          throw new Error('Cannot send sale email: customer name is missing');
        if (!address?.line1)
          throw new Error('Cannot send sale email: address line 1 is missing');
        if (!address.city)
          throw new Error('Cannot send sale email: shipping city is missing');
        if (!address.state)
          throw new Error('Cannot send sale email: shipping state is missing');
        if (!address.postal_code)
          throw new Error(
            'Cannot send sale email: shipping postal code is missing'
          );
        if (!address.country)
          throw new Error(
            'Cannot send sale email: shipping country is missing'
          );

        const primaryRef = tenantDoc.primaryContact;
        let primaryContactUser: User | null = null;

        if (typeof primaryRef === 'string') {
          try {
            primaryContactUser = (await tryCall(
              'users.findByID(primaryRef)',
              () =>
                payload.findByID({
                  collection: 'users',
                  id: primaryRef,
                  depth: 0,
                  overrideAccess: true
                })
            )) as User | null;
          } catch {
            primaryContactUser = null;
          }
        } else if (primaryRef && typeof primaryRef === 'object') {
          primaryContactUser = primaryRef as User;
        }

        const sellerEmail: string | null =
          tenantDoc.notificationEmail ?? primaryContactUser?.email ?? null;

        const tenantIdForGroup = tenantDoc.id;

        const sellerNameFinal: string =
          tenantDoc.notificationName ??
          primaryContactUser?.firstName ??
          (primaryContactUser ? primaryContactUser.username : undefined) ??
          tenantDoc.name ??
          'Seller';

        await tryCall('email.sendOrderConfirmation', () =>
          sendOrderConfirmationEmail({
            // to: user.email ?? 'customer@example.com',
            to: 'jay@abandonedhobby.com', // temp
            name: user.firstName,
            creditCardStatement:
              charge.statement_descriptor ?? 'ABANDONED HOBBY',
            creditCardBrand:
              charge.payment_method_details?.card?.brand ?? 'N/A',
            creditCardLast4:
              charge.payment_method_details?.card?.last4 ?? '0000',
            receiptId: orderDocId,
            orderDate: new Date().toLocaleDateString('en-US'),
            lineItems: receiptLineItems,
            total: `$${(totalCents / 100).toFixed(2)}`,
            support_url:
              process.env.SUPPORT_URL || 'https://abandonedhobby.com/support',
            item_summary: summary
          })
        );

        if (!sellerEmail) {
          throw new Error(
            `No seller notification email configured for tenant ${tenantDoc.id}`
          );
        }

        await tryCall('email.sendSaleNotification', () =>
          sendSaleNotificationEmail({
            // to: sellerEmail,
            to: 'jay@abandonedhobby.com', // temp
            sellerName: sellerNameFinal,
            receiptId: orderDocId,
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
          })
        );

        // Analytics (best-effort)
        try {
          posthogServer?.capture({
            distinctId: user.id ?? expanded.customer_email ?? 'unknown',
            event: 'purchaseCompleted',
            properties: {
              stripeSessionId: session.id,
              amountTotal: totalCents,
              currency,
              productIdsFromLines: productIds,
              tenantId: tenantIdForGroup,
              $insert_id: `purchase:${session.id}`
            },
            groups: tenantIdForGroup ? { tenant: tenantIdForGroup } : undefined
          });

          await flushIfNeeded();
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[analytics] purchaseCompleted capture failed:',
              error
            );
          }
        }

        await markProcessed(payload, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;

        const md = (pi.metadata ?? {}) as Record<string, string>;
        const buyerId = md.userId ?? md.buyerId ?? 'anonymous';
        const tenantId = md.tenantId;
        const tenantSlug = md.tenantSlug;
        const productIds =
          typeof md.productIds === 'string' && md.productIds.length
            ? md.productIds
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
              stripePaymentIntentId: pi.id,
              failureCode: pi.last_payment_error?.code,
              failureMessage: pi.last_payment_error?.message,
              tenantId,
              tenantSlug,
              productIds,
              $insert_id: event.id
            },
            groups: tenantId ? { tenant: tenantId } : undefined,
            timestamp: new Date(event.created * 1000)
          });

          await flushIfNeeded();
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[analytics] checkoutFailed capture failed:', err);
          }
        }

        await markProcessed(payload, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;

        const md = (session.metadata ?? {}) as Record<string, string>;
        const buyerId = md.userId ?? md.buyerId ?? 'anonymous';
        const tenantId = md.tenantId;
        const tenantSlug = md.tenantSlug;
        const productIds =
          typeof md.productIds === 'string' && md.productIds.length
            ? md.productIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((id, i, a) => a.indexOf(id) === i)
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
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[analytics] checkoutFailed(expired) capture failed:',
              err
            );
          }
        }

        await markProcessed(payload, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await tryCall('tenants.update(stripeDetailsSubmitted)', () =>
          payload.update({
            collection: 'tenants',
            where: { stripeAccountId: { equals: account.id } },
            data: { stripeDetailsSubmitted: account.details_submitted },
            overrideAccess: true
          })
        );

        await markProcessed(payload, event.id);
        return NextResponse.json({ updated: true }, { status: 200 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const e = error as Error;
    console.error('Webhook handler failed:', message);
    if (e.stack) console.error('Error stack: ', e.stack);

    // In dev, consider 200 to avoid aggressive Stripe retries
    // await markProcessed(payload, event.id);
    // return NextResponse.json(
    //   { message: `Webhook handler failed: ${message}` },
    //   { status: 200 }
    // );
    const status = process.env.NODE_ENV === 'production' ? 500 : 200;
    if (status === 200) {
      // Optional: avoid noisy retries only during local development.
      await markProcessed(payload, event.id);
    }
    return NextResponse.json(
      { message: `Webhook handler failed: ${message}` },
      { status }
    );
  }
}
