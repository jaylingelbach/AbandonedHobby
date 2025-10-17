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
 * NOTE:
 * - Uses a single conditional findOneAndUpdate with $inc and stockQuantity >= qty
 *   so concurrent handlers cannot oversell.
 * - If stock hits 0 and autoArchive=true, we immediately set isArchived in a
 *   second, quick update. This isn't “atomic with the decrement”, but it’s safe:
 *   once stock is 0, archiving is idempotent and can’t cause oversell.
 * - This path bypasses Payload hooks (it updates via the underlying Mongoose
 *   Model), which also avoids re-entrancy issues. Keep your product hooks in mind.
 * ────────────────────────────────────────────────────────────────────────────── */

async function decProductStockAtomic(
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

async function decrementInventoryBatch(args: {
  payload: import('payload').Payload;
  qtyByProductId: Map<string, number>;
}): Promise<void> {
  const { payload, qtyByProductId } = args;

<<<<<<< HEAD
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
=======
  for (const [productId, purchasedQty] of qtyByProductId) {
    const res = await decProductStockAtomic(payload, productId, purchasedQty, {
      autoArchive: true
    });
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)

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
<<<<<<< HEAD
      failures.push({ productId, reason: result.reason });
=======
      // Optional: flag order for manual review on 'insufficient' etc.
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
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

/**
 * Conditionally executes a provided async action when webhook emails are enabled.
 *
 * @param label - Short label used for logging/tracing the action
 * @param fn - Async function to run when emails are enabled
 * @returns The value returned by `fn`, or `null` if webhook emails are disabled
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
 *
 * Stripe has moved shipping data through a few shapes over time. This resolver:
 *
 * Priority (newest → oldest) on the **Checkout Session**:
 *  1. `collected_information.shipping_details`  (new API shape)
 *  2. `shipping_details`                        (intermediate shape)
 *  3. `shipping`                                (legacy shape)
 *
 * If the Checkout Session provides no usable shipping, we then fall back to:
 *  - `paymentIntent.shipping`
 *  - `charge.shipping`
 * And finally to:
 *  - `session.customer_details` (billing details) as a last resort
 *
 * The function returns a normalized object compatible with your `orders.shipping` group:
 * ```
 * {
 *   name?: string;
 *   line1: string;
 *   line2?: string;
 *   city?: string;
 *   state?: string;
 *   postalCode?: string;
 *   country?: string; // ISO-2
 * }
 * ```
 * or `undefined` if no usable address was found.
 *
 * Type-safety notes:
 * - We avoid `any` and use small local structural types (`ShippingLike`, `AddressLike`),
 *   combined with `unknown`→narrowed casts for Stripe objects that may or may not
 *   expose these properties depending on API version/typing.
 *
 * @param args
 * @param args.expanded
 *   The **expanded** Stripe Checkout Session (should include `customer_details`,
 *   and may include `collected_information.shipping_details`, `shipping_details`,
 *   or legacy `shipping`).
 * @param args.paymentIntent
 *   The PaymentIntent associated with the Checkout Session; may contain `shipping`.
 * @param args.charge
 *   The Charge associated with the PaymentIntent; may contain `shipping`.
 * @param args.buyerFallbackName
 *   Optional display name to use when no explicit shipping/customer name is present.
 *
 * @returns
 *   A normalized shipping object suitable for persisting to `orders.shipping` field,
 *   or `undefined` when no address info can be resolved.
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

  // Minimal shapes (no `any`)
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

  const sx = expanded as unknown as SessionWithShipping;

  const sessionShipping =
    sx.collected_information?.shipping_details ??
    sx.shipping_details ??
    sx.shipping ??
    null;

  const billing = expanded.customer_details ?? null;

  const piShipping =
    (paymentIntent.shipping as unknown as ShippingLike | null) ?? null;
  const chargeShipping =
    (charge.shipping as unknown as ShippingLike | null) ?? null;

  const resolvedName =
    sessionShipping?.name ??
    piShipping?.name ??
    chargeShipping?.name ??
    billing?.name ??
    buyerFallbackName ??
    'Customer';

  const addr: AddressLike | null =
    sessionShipping?.address ??
    piShipping?.address ??
    chargeShipping?.address ??
    billing?.address ??
    null;

  // Only return a shipping object when we actually have a line1.
  if (!addr?.line1) return null;

  return {
    name: resolvedName,
    line1: addr.line1, // required
    line2: addr.line2 ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    postalCode: addr.postal_code ?? null,
    country: addr.country ?? null
  };
}

/**
 * Handle incoming Stripe webhook POST requests for a subset of event types and perform corresponding side effects.
 *
 * Verifies the Stripe signature, rejects invalid payloads, deduplicates events, and processes:
 * - checkout.session.completed: creates idempotent orders, decrements inventory, sends emails, and records analytics.
 * - payment_intent.payment_failed and checkout.session.expired: records checkout failure analytics.
 * - account.updated: updates tenant Stripe submission status.
 *
 * Events not in the permitted set are marked processed and ignored to prevent retries.
 *
 * @param req - The incoming HTTP request containing the raw Stripe webhook body and signature header.
 * @returns A NextResponse with a JSON body describing the outcome (e.g., received/ignored/updated or an error message). */

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
    'account.updated',
    'refund.created',
    'refund.updated',
    'charge.refunded'
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

  /**
   * Resolve the local order ID associated with a Stripe refund.
   *
   * Searches the local refunds collection for a refund with the Stripe refund ID and returns its `order` relation if present; if not found, falls back to matching an order by the refund's `payment_intent` or `charge`.
   *
   * @param args.payload - Payload CMS instance used to query collections
   * @param args.rf - Stripe Refund object to resolve
   * @returns The matching order ID as a string, or `null` if no associated order is found
   */
  async function resolveOrderIdForRefund(args: {
    payload: import('payload').Payload;
    rf: Stripe.Refund;
  }): Promise<string | null> {
    const { payload, rf } = args;

    // A) Preferred: find our local refund record by stripeRefundId and read its `order` relationship
    {
      const list = await payload.find({
        collection: 'refunds',
        where: { stripeRefundId: { equals: rf.id } },
        depth: 0,
        limit: 1,
        overrideAccess: true
      });

      const doc = list.docs[0];
      if (doc) {
        const rel = doc.order as string | { id?: string } | null | undefined;
        const orderId =
          typeof rel === 'string' ? rel : rel && rel.id ? String(rel.id) : null;
        if (orderId) return orderId;
      }
    }

    // B) Fallback: map from PI or Charge directly to an Order
    const pi = typeof rf.payment_intent === 'string' ? rf.payment_intent : null;
    const ch = typeof rf.charge === 'string' ? rf.charge : null;

    if (pi) {
      const ordersByPI = await payload.find({
        collection: 'orders',
        where: { stripePaymentIntentId: { equals: pi } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      if (ordersByPI.docs[0]?.id) return String(ordersByPI.docs[0].id);
    }

    if (ch) {
      const ordersByCharge = await payload.find({
        collection: 'orders',
        where: { stripeChargeId: { equals: ch } },
        limit: 1,
        depth: 0,
        overrideAccess: true
      });
      if (ordersByCharge.docs[0]?.id) return String(ordersByCharge.docs[0].id);
    }

    console.warn('[webhook] resolveOrderIdForRefund failed', {
      refundId: rf.id,
      paymentIntent: pi,
      charge: ch
    });

    return null;
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
            id: userId,
            depth: 0,
            overrideAccess: true
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
<<<<<<< HEAD
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
=======
                .filter((i) => typeof i.product === 'string')
                .map((i) => ({
                  product: i.product as string,
                  quantity: typeof i.quantity === 'number' ? i.quantity : 1
                }))
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
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

<<<<<<< HEAD
        if (
          totalAmountInCents <= 0 &&
          typeof paymentIntent.amount_received === 'number'
        ) {
          totalAmountInCents = paymentIntent.amount_received;
=======
        if (!totalCents && typeof paymentIntent.amount_received === 'number') {
          totalCents = paymentIntent.amount_received;
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
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

<<<<<<< HEAD
        const currencyCode = (expandedSession.currency ?? 'USD').toUpperCase();
        const orderNumber = `AH-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const firstItemName = orderItems[0]?.nameSnapshot ?? 'Order';
        const orderDisplayName =
=======
        const currency = (expanded.currency ?? 'USD').toUpperCase();
        const orderNumber = `AH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        const firstName = orderItems[0]?.nameSnapshot ?? 'Order';
        const orderName =
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
          orderItems.length > 1
            ? `${firstName} (+${orderItems.length - 1} more)`
            : firstName;

        const shippingGroup = resolveShippingForOrder({
          expanded,
          paymentIntent,
          charge,
          buyerFallbackName: user.firstName
        });

<<<<<<< HEAD
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

=======
        // Create order (idempotent via unique session id; catch unique violation)
        let orderDocId: string;
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
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
                ...(shippingGroup ? { shipping: shippingGroup } : {}) // ← only when valid
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

<<<<<<< HEAD
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
=======
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
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
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

<<<<<<< HEAD
        // Send seller notification(s) even if shipping is partial or missing
        for (const recipientEmail of recipientEmails) {
          const recipientDisplayName =
            recipientNameByEmail.get(recipientEmail) ?? 'Seller';
=======
        const tenantIdForGroup = tenantDoc.id;

        const sellerNameFinal: string =
          tenantDoc.notificationName ??
          primaryContactUser?.firstName ??
          (primaryContactUser ? primaryContactUser.username : undefined) ??
          tenantDoc.name ??
          'Seller';
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)

        await sendIfEnabled('email.sendOrderConfirmation', () =>
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

        await sendIfEnabled('email.sendSaleNotification', () =>
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
<<<<<<< HEAD
            distinctId: user.id ?? 'unknown',
=======
            distinctId: user.id ?? expanded.customer_email ?? 'unknown',
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
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
      case 'refund.updated': {
        const rf = event.data.object as Stripe.Refund;

        // syncs the local refund doc’s status with Stripe.
        try {
          await payload.update({
            collection: 'refunds',
            where: { stripeRefundId: { equals: rf.id } },
            data: { status: toLocalRefundStatus(rf.status) },
            overrideAccess: true
          });
        } catch {
          // ignore if we don’t have a local row (e.g., refund created in Stripe dashboard)
        }

        const orderId = await resolveOrderIdForRefund({ payload, rf });
        if (orderId) {
          // totals all successful refunds for the order, updates refundTotalCents, lastRefundAt, and derived status (paid/partially_refunded/refunded).
          // If you want in-flight refunds to count, pass includePending: true
          await recomputeRefundState({
            payload,
            orderId,
            includePending: true
          });
        }

        await markProcessed(payload, event.id);
        return NextResponse.json({ ok: true }, { status: 200 });
      }
      case 'refund.created': {
        const rf = event.data.object as Stripe.Refund;

        // Keep local refund row (if present) in sync with Stripe status
        try {
          await payload.update({
            collection: 'refunds',
            where: { stripeRefundId: { equals: rf.id } },
            data: { status: toLocalRefundStatus(rf.status) },
            overrideAccess: true
          });
        } catch (error) {
          // It's fine if no local row exists (e.g. refund was created from Stripe Dashboard)
          console.warn('[webhook] failed to sync refund row', error);
        }

        // Find related order by (local row → payment_intent → charge)
        const orderId = await resolveOrderIdForRefund({ payload, rf });

        // Recompute order-level refund totals / derived status
        if (orderId) {
          await recomputeRefundState({
            payload,
            orderId,
            includePending: true // set true to count pending in totals if you prefer
          });
        }

        await markProcessed(payload, event.id);
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      case 'charge.refunded': {
        // Some platforms prefer to key off charge-level events
        const ch = event.data.object as Stripe.Charge;

        // Try PI first (more stable), then charge id
        const pi =
          typeof ch.payment_intent === 'string' ? ch.payment_intent : null;

        const rfLike = {
          id: `charge:${ch.id}`, // not used when we’ve already updated our local row
          payment_intent: pi ?? undefined,
          charge: ch.id // synthetic ID for resolver
        } as unknown as Stripe.Refund;

        const orderId = await resolveOrderIdForRefund({ payload, rf: rfLike });
        if (orderId) {
          await recomputeRefundState({
            payload,
            orderId,
            includePending: true
          });
        }

        await markProcessed(payload, event.id);
        return NextResponse.json({ ok: true }, { status: 200 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const err = error as Error;
    console.error('Webhook handler failed:', message);
    if (err.stack) console.error('Error stack: ', err.stack);

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
<<<<<<< HEAD

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
=======
>>>>>>> parent of d70921a (refactor webhook inventory handling for seller dashboard)
}
