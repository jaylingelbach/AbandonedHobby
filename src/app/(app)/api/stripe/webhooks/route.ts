import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import Stripe from 'stripe';
import crypto from 'node:crypto';
import { formatCents } from '@/lib/utils';

import config from '@payload-config';

import {
  sendOrderConfirmationEmail,
  sendSaleNotificationEmail
} from '@/lib/sendEmail';
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

import { OrderItemOutput } from '@/modules/stripe/build-order-items';

import { toQtyMap, getProductsModel, tryCall } from './utils/utils';
import {
  parseStripeMetadata,
  captureAnalyticsEvent,
  buildReceiptModels,
  handleDuplicateOrder
} from './utils/helpers';
import {
  recomputeRefundState,
  toLocalRefundStatus
} from '@/modules/refunds/utils';
import { isUniqueViolation } from '@/lib/server/errors/errors';

export const runtime = 'nodejs';

// Stripe’s expanded line item with expanded product metadata.id guaranteed.
export type ExpandedLineItem = Stripe.LineItem & {
  price: Stripe.Price & {
    product: Stripe.Product & { metadata: Record<string, string> };
  };
};

/** Type used in computerFeesFromCharge */
type FeeResult = {
  stripeFeeCents: number; // processing-only
  platformFeeCents: number; // application fee
  receiptUrl: string | null;
};

/** Compute fees directly from an expanded charge (preferred). */
function computeFeesFromCharge(charge: Stripe.Charge): FeeResult {
  const balanceTransaction =
    charge.balance_transaction as Stripe.BalanceTransaction | null;

  const applicationFeeCents =
    typeof charge.application_fee_amount === 'number'
      ? charge.application_fee_amount
      : 0;

  let processingFeeCents = 0;

  // Prefer fee_details if present (most accurate)
  const details = Array.isArray(balanceTransaction?.fee_details)
    ? balanceTransaction.fee_details
    : null;

  if (details) {
    // Sum everything that is NOT the application fee
    processingFeeCents = details
      .filter((d) => d.type !== 'application_fee')
      .reduce(
        (sum, d) => sum + (typeof d.amount === 'number' ? d.amount : 0),
        0
      );
  } else {
    const totalFee =
      typeof balanceTransaction?.fee === 'number' ? balanceTransaction.fee : 0;
    processingFeeCents = Math.max(0, totalFee - applicationFeeCents);
  }

  const receiptUrl =
    typeof charge.receipt_url === 'string' ? charge.receipt_url : null;

  return {
    stripeFeeCents: processingFeeCents,
    platformFeeCents: applicationFeeCents,
    receiptUrl
  };
}
/**
 * Read the Stripe processing fee (merchant/processor), the application (platform) fee, and the charge receipt URL for a given Stripe charge or payment intent on a connected account.
 *
 * If `paymentIntentId` is provided, the latest charge for that payment intent is used. If neither `paymentIntentId` nor `chargeId` is provided, zeros and `null` are returned.
 *
 * @param args.stripeAccountId - The Stripe connected account ID to query against.
 * @param args.paymentIntentId - Optional Stripe PaymentIntent ID to derive the charge from.
 * @param args.chargeId - Optional Stripe Charge ID to read fees and receipt from.
 * @returns An object with:
 *  - `stripeFeeCents`: processing-only fee in cents,
 *  - `platformFeeCents`: application/platform fee in cents,
 *  - `receiptUrl`: the charge's receipt URL or `null`.
 */

async function readStripeFeesAndReceiptUrl(args: {
  stripeAccountId: string;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  charge?: Stripe.Charge | null; // ← new fast path
}): Promise<FeeResult> {
  const { stripeAccountId, paymentIntentId, chargeId, charge } = args;

  // Fast path: use already-fetched (and ideally expanded) charge
  if (charge) {
    // If somehow not expanded, fall back to one retrieve with expand
    if (
      charge.balance_transaction == null ||
      typeof charge.balance_transaction === 'string'
    ) {
      const hydrated = await stripe.charges.retrieve(
        charge.id,
        { expand: ['balance_transaction'] },
        { stripeAccount: stripeAccountId }
      );
      return computeFeesFromCharge(hydrated);
    }
    return computeFeesFromCharge(charge);
  }

  // Otherwise, resolve by paymentIntent or chargeId with a single retrieve
  async function fromChargeId(id: string): Promise<FeeResult> {
    const fetched = await stripe.charges.retrieve(
      id,
      { expand: ['balance_transaction'] },
      { stripeAccount: stripeAccountId }
    );
    return computeFeesFromCharge(fetched);
  }

  if (paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge.balance_transaction'] },
      { stripeAccount: stripeAccountId }
    );
    const latestCharge = paymentIntent.latest_charge as Stripe.Charge | null;
    if (latestCharge?.id) {
      if (
        latestCharge.balance_transaction == null ||
        typeof latestCharge.balance_transaction === 'string'
      ) {
        // Should be expanded by the PI expand above, but hydrate if not
        return fromChargeId(latestCharge.id);
      }
      return computeFeesFromCharge(latestCharge);
    }
  }

  if (chargeId) return fromChargeId(chargeId);

  return { stripeFeeCents: 0, platformFeeCents: 0, receiptUrl: null };
}

/**
 * Atomically decreases a product's stock by a given quantity and optionally archives the product when stock reaches zero.
 *
 * Validates that `quantity` is a positive integer. Attempts an atomic Mongo/Mongoose decrement when available and falls back to a Payload read-and-update path if necessary. May mark the product archived when `options.autoArchive` is true and resulting stock is zero.
 *
 * @param productId - The product document ID to decrement.
 * @param quantity - Quantity to subtract; must be an integer greater than zero.
 * @param options.autoArchive - If true, set the product's `isArchived` flag when stock reaches zero.
 * @returns On success: `{ ok: true, after: { stockQuantity }, archived }` with the resulting stock and whether the product is archived. On failure: `{ ok: false, reason }` where `reason` is one of:
 * - `not-supported` — atomic decrement not available,
 * - `not-tracked` — product does not track stockQuantity,
 * - `not-found` — product not found,
 * - `insufficient` — not enough stock to fulfill the decrement.
 */

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

  // Payload fallback path
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

/**
 * Attempts to decrement stock for a batch of products, retrying transient insufficient-stock conflicts.
 *
 * For each product in `qtyByProductId` this function calls `decrementProductStockAtomic` (up to 3 attempts when the failure reason is "insufficient") and logs successes or failures. If any product fails to decrement, a consolidated error line is written to stderr.
 *
 * @param args.payload - Payload CMS instance used to read and update product documents.
 * @param args.qtyByProductId - Map of product IDs to quantities to decrement.
 */
async function decrementInventoryBatch(args: {
  payload: import('payload').Payload;
  qtyByProductId: Map<string, number>;
}): Promise<void> {
  const { payload: payloadInstance, qtyByProductId } = args;

  const failures: Array<{ productId: string; reason: string }> = [];
  for (const [productId, purchasedQuantity] of qtyByProductId) {
    let attempts = 0;
    let result:
      | {
          ok: true;
          after: { stockQuantity: number };
          archived: boolean;
        }
      | {
          ok: false;
          reason:
            | 'not-supported'
            | 'not-tracked'
            | 'not-found'
            | 'insufficient';
        };
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
    const detail = failures
      .map((failure) => `${failure.productId}:${failure.reason}`)
      .join(', ');
    console.error('[inv] dec-atomic failed summary', { detail, failures });
    const error = new Error(`Inventory decrement failed: ${detail}`);
    (error as { failures?: typeof failures }).failures = failures;
    throw error;
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
 * Finds the tenant ID for the first product referenced in the provided order items.
 *
 * @param items - Array of order line items; each item must contain a `product` id string.
 * @param productsById - Map from product id to `Product` objects used to resolve the product's tenant relation.
 * @returns The resolved tenant id for the first product that has a tenant.
 * @throws Error if no product in `items` resolves to a tenant id.
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
 * Resolve the email address and display name to use when notifying a tenant about a sale.
 *
 * @param args.tenant - Tenant object that may contain `notificationEmail`, `notificationName`, `primaryContact`, and `name` used to derive the contact.
 * @returns An object with `email` set to `tenant.notificationEmail` if present, otherwise the primary contact user's email if available, or `null`; `displayName` set to `tenant.notificationName`, otherwise the primary user's `firstName` or `username`, otherwise `tenant.name`, or `'Seller'`.
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
 * Handle Stripe webhook POST requests: validate the signature, deduplicate events,
 * and process supported event types (checkout sessions, payment failures/expiration,
 * account updates, refunds, and charge refunds) to create/update orders, adjust inventory,
 * sync refund state, send notifications, and record analytics.
 *
 * The request must include Stripe's signature header (`stripe-signature`) and a body
 * containing the raw webhook payload; the function verifies the payload using
 * STRIPE_WEBHOOK_SECRET.
 *
 * @param req - The incoming HTTP Request containing the Stripe webhook payload and the `stripe-signature` header
 * @returns A NextResponse JSON object describing the outcome. Typical HTTP statuses:
 *          200 for processed/ignored/deduplicated events, 400 for webhook verification errors,
 *          and 500 for internal errors in production (non-production environments return 200 on handler errors).
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

        if (!event.account) {
          throw new Error('Stripe account ID is required for order creation');
        }
        const accountId: string = event.account;

        // ---- Resolve userId via attemptId (recommended) or legacy metadata.userId ----
        const rawSessionMetadata = (session.metadata ?? {}) as Record<
          string,
          string
        >;

        const attemptIdFromClientRef =
          typeof session.client_reference_id === 'string'
            ? session.client_reference_id
            : null;

        const attemptIdFromMetadata =
          typeof rawSessionMetadata.userRef === 'string' &&
          rawSessionMetadata.userRef.trim().length > 0
            ? rawSessionMetadata.userRef.trim()
            : null;

        const attemptId =
          attemptIdFromClientRef ?? attemptIdFromMetadata ?? null;

        let userId: string | null = null;

        // 1) Preferred path: look up userId from pending-checkout-attempts
        if (attemptId) {
          try {
            const pendingResult = await tryCall(
              'pending-checkout-attempts.findByAttemptId',
              () =>
                payloadInstance.find({
                  collection: 'pending-checkout-attempts',
                  where: { attemptId: { equals: attemptId } },
                  limit: 1,
                  depth: 0,
                  overrideAccess: true
                })
            );

            const pendingDoc = pendingResult.docs[0] as
              | { userId?: unknown }
              | undefined;

            const candidateUserId =
              typeof pendingDoc?.userId === 'string' &&
              pendingDoc.userId.trim().length > 0
                ? pendingDoc.userId.trim()
                : null;

            if (candidateUserId) {
              userId = candidateUserId;
            }
          } catch (lookupError) {
            // Don't mask DB errors - they should be retried by Stripe
            console.error(
              '[webhook] failed to resolve userId from pending-checkout-attempts',
              {
                attemptId,
                error: lookupError
              }
            );
            throw new Error(
              `Failed to lookup pending checkout attempt: ${lookupError instanceof Error ? lookupError.message : String(lookupError)}`
            );
          }
        }

        // 2) Back-compat: fall back to legacy metadata.userId for older sessions
        if (!userId) {
          const legacyUserId =
            typeof rawSessionMetadata.userId === 'string' &&
            rawSessionMetadata.userId.trim().length > 0
              ? rawSessionMetadata.userId.trim()
              : null;

          if (legacyUserId) {
            userId = legacyUserId;
          }
        }

        // 3) If we *still* have no userId, log and bail (do NOT throw)
        if (!userId) {
          console.error(
            '[webhook] checkout.session.completed: unable to resolve userId',
            {
              sessionId: session.id,
              attemptId,
              client_reference_id: session.client_reference_id,
              metadata: rawSessionMetadata
            }
          );
          // Return 200 so Stripe is happy; we simply skip order creation
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const user = (await tryCall('users.findByID', () =>
          payloadInstance.findByID({
            collection: 'users',
            id: userId as string,
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
          await handleDuplicateOrder({
            existing,
            event,
            accountId,
            payloadInstance,
            readStripeFeesAndReceiptUrl,
            decrementInventoryBatch
          });
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // -------- Primary path (new order) --------
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

        const amountShipping =
          expandedSession.total_details?.amount_shipping ??
          expandedSession.shipping_cost?.amount_total ??
          0;

        let totalAmountInCents =
          sumAmountTotalCents(rawLineItems) + amountShipping;

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
          stripe.charges.retrieve(
            chargeId as string,
            {
              expand: ['balance_transaction']
            },
            { stripeAccount: accountId }
          )
        );

        // Get processing-only fee + application fee + receipt URL
        const { stripeFeeCents, platformFeeCents, receiptUrl } =
          await readStripeFeesAndReceiptUrl({
            stripeAccountId: accountId,
            // paymentIntentId is not needed when we already have the charge
            charge
          });
        console.log('[webhook][fees]', {
          sessionId: session.id,
          paymentIntentId: paymentIntent.id,
          chargeId: String(charge.id),
          stripeFeeCents,
          platformFeeCents,
          receiptUrl
        });

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

        // Resolve payout tenant
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
                  limit: Math.max(productIds.length, 1),
                  pagination: false,
                  depth: 0,
                  overrideAccess: true
                })
              )
            : { docs: [] as Product[] };

        const productById = new Map<string, Product>(
          (productsResult.docs as Product[]).map((p) => [p.id, p])
        );

        const orderItems: OrderItemOutput[] = buildOrderItems(
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

        // Create order with trusted fees via context (so hook uses them)
        let orderDocumentId: string;

        const createContext = {
          ahSystem: true as const,
          fees: {
            platformFeeCents: platformFeeCents,
            stripeFeeCents: stripeFeeCents,
            shippingTotalCents: amountShipping
          }
        };

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
                sellerTenant: productTenantId,
                currency: currencyCode,
                product: firstProductId, // legacy back-compat
                stripeAccountId: accountId,
                stripeCheckoutSessionId: session.id,
                stripeEventId: event.id,
                stripePaymentIntentId: paymentIntent.id,
                stripeChargeId: String(charge.id),
                items: orderItems,
                returnsAcceptedThrough: returnsAcceptedThroughISO,
                buyerEmail:
                  expandedSession.customer_details?.email ?? undefined,
                status: 'paid',
                fulfillmentStatus: 'unfulfilled',
                total: totalAmountInCents,
                ...(shippingGroup ? { shipping: shippingGroup } : {}),
                // Store these too (doc is self-contained), but context is what the hook trusts
                amounts: {
                  stripeFeeCents,
                  platformFeeCents,
                  shippingTotalCents: amountShipping
                },
                documents: { receiptUrl }
              },
              overrideAccess: true,
              context: createContext
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

        const shippingResolved = shippingGroup;

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

        // ── Build receipt models for emails ────────────────────────────────────────
        const buyerReceiptModels = buildReceiptModels({
          expandedSession,
          rawLineItems,
          orderItems,
          amountShipping,
          totalAmountInCents,
          currencyCode
        });

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
              item_summary: lineItemSummary,
              receipt_details_v2: buyerReceiptModels.receiptDetailsV2,
              amounts: buyerReceiptModels.amountsModel
            })
          );
        } else {
          console.warn(
            '[email] customer confirmation skipped: no buyer email resolved'
          );
        }

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

        // ── Compute seller receipt models once (outside loop) ────────────────────────
        const sellerReceiptModels = buildReceiptModels({
          expandedSession,
          rawLineItems,
          orderItems,
          amountShipping,
          totalAmountInCents,
          currencyCode
        });

        const feesModel = {
          platform_fee: formatCents(platformFeeCents, currencyCode),
          stripe_fee: formatCents(stripeFeeCents, currencyCode),
          net_payout: formatCents(
            Math.max(
              0,
              sellerReceiptModels.grossTotalCents -
                platformFeeCents -
                stripeFeeCents
            ),
            currencyCode
          )
        };

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
              receipt_details_v2: sellerReceiptModels.receiptDetailsV2,
              amounts: sellerReceiptModels.amountsModel,
              fees: feesModel,
              total: `$${(sellerReceiptModels.grossTotalCents / 100).toFixed(2)}`,
              item_summary: lineItemSummary,
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

        const totalQuantity = Array.from(quantityByProductId.values()).reduce(
          (sum, qty) => sum + qty,
          0
        );

        const quantityByProductIdObject =
          Object.fromEntries(quantityByProductId);

        // Analytics (best-effort)
        await captureAnalyticsEvent({
          event: 'purchaseCompleted',
          distinctId: user.id ?? 'unknown',
          properties: {
            stripeSessionId: session.id,
            amountTotal: totalAmountInCents,
            currency: currencyCode,
            productIdsFromLines: productIds,
            tenantId: payoutTenantDocument.id,
            itemCount: totalQuantity, // total units purchased
            quantityByProductId: quantityByProductIdObject, // { [productId]: quantity }
            $insert_id: `purchase:${session.id}`
          },
          groups: payoutTenantDocument.id
            ? { tenant: payoutTenantDocument.id }
            : undefined
        });

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const { buyerId, tenantId, tenantSlug, productIds } =
          parseStripeMetadata(paymentIntent.metadata);

        await captureAnalyticsEvent({
          event: 'checkoutFailed',
          distinctId: buyerId,
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

        await markProcessed(payloadInstance, event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;

        const { buyerId, tenantId, tenantSlug, productIds } =
          parseStripeMetadata(session.metadata);

        await captureAnalyticsEvent({
          event: 'checkoutFailed',
          distinctId: buyerId,
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
