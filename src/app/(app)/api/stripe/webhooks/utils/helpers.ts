import Stripe from 'stripe';
import { formatCents } from '@/lib/utils';
import { posthogServer } from '@/lib/server/posthog-server';
import { buildReceiptDetailsV2, ReceiptItemInput } from '@/lib/sendEmail';
import { markProcessed } from '@/modules/stripe/guards';
import { flushIfNeeded } from './utils';
import { toQtyMap, tryCall } from './utils';
import type { ExistingOrderPrecheck } from './types';
import type { OrderItemOutput } from '@/modules/stripe/build-order-items';

/**
 * Parse Stripe metadata to extract common fields used across webhook handlers.
 *
 * @param metadata - The metadata object from a Stripe resource (session, payment intent, etc.)
 * @returns Parsed metadata with buyerId, tenantId, tenantSlug, and deduplicated productIds array
 */
export function parseStripeMetadata(
  metadata: Record<string, string> | null | undefined
): {
  buyerId: string;
  tenantId?: string;
  tenantSlug?: string;
  productIds?: string[];
} {
  const meta = (metadata ?? {}) as Record<string, string>;
  const buyerId = meta.userId ?? meta.buyerId ?? 'anonymous';
  const tenantId = meta.tenantId;
  const tenantSlug = meta.tenantSlug;

  const productIds =
    typeof meta.productIds === 'string' && meta.productIds.length
      ? meta.productIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((id, index, self) => self.indexOf(id) === index)
      : undefined;

  return { buyerId, tenantId, tenantSlug, productIds };
}

/**
 * Capture an analytics event with PostHog, handling errors gracefully.
 *
 * This is a best-effort operation that will not throw errors. Failures are logged
 * in non-production environments only.
 *
 * @param args.event - The event name (e.g., 'purchaseCompleted', 'checkoutFailed')
 * @param args.distinctId - The user/distinct identifier
 * @param args.properties - Event properties to capture
 * @param args.groups - Optional group associations (e.g., { tenant: tenantId })
 * @param args.timestamp - Optional timestamp (defaults to now)
 */
export async function captureAnalyticsEvent(args: {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
  groups?: Record<string, string>;
  timestamp?: Date;
}): Promise<void> {
  try {
    posthogServer?.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
      groups: args.groups,
      timestamp: args.timestamp
    });

    await flushIfNeeded();
  } catch (analyticsError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[analytics] ${args.event} capture failed:`, analyticsError);
    }
  }
}

/**
 * Build receipt models for email notifications.
 *
 * Computes all receipt-related values including subtotals, shipping, discounts, taxes,
 * and formats them for use in email templates.
 *
 * @param args.expandedSession - The expanded Stripe checkout session
 * @param args.rawLineItems - Raw Stripe line items
 * @param args.orderItems - Processed order items
 * @param args.amountShipping - Shipping amount in cents
 * @param args.totalAmountInCents - Total amount in cents
 * @param args.currencyCode - Currency code (e.g., 'USD')
 * @returns Receipt models with all computed values
 */
export function buildReceiptModels(args: {
  expandedSession: Stripe.Checkout.Session;
  rawLineItems: Stripe.LineItem[];
  orderItems: OrderItemOutput[];
  amountShipping: number;
  totalAmountInCents: number;
  currencyCode: string;
}) {
  const itemsSubtotalCents: number =
    typeof args.expandedSession.amount_subtotal === 'number'
      ? args.expandedSession.amount_subtotal
      : args.rawLineItems.reduce((sum, line) => {
          const subtotal =
            typeof line.amount_subtotal === 'number' ? line.amount_subtotal : 0;
          return sum + subtotal;
        }, 0);

  const shippingTotalCents: number = args.amountShipping;
  const discountTotalCents: number =
    args.expandedSession.total_details?.amount_discount ?? 0;
  const taxTotalCents: number =
    args.expandedSession.total_details?.amount_tax ?? 0;
  const grossTotalCents: number = args.totalAmountInCents;

  const detailInputs: ReceiptItemInput[] = args.orderItems.map((orderItem) => ({
    name: orderItem.nameSnapshot,
    quantity: orderItem.quantity,
    unitAmountCents: orderItem.unitAmount ?? 0,
    amountTotalCents:
      orderItem.amountTotal ?? orderItem.quantity * (orderItem.unitAmount ?? 0),
    shippingMode: orderItem.shippingMode,
    shippingFeeCentsPerUnit: orderItem.shippingFeeCentsPerUnit ?? null,
    shippingSubtotalCents: orderItem.shippingSubtotalCents ?? null
  }));

  const receiptDetailsV2 = buildReceiptDetailsV2(
    detailInputs,
    args.currencyCode
  );

  const amountsModel = {
    items_subtotal: formatCents(itemsSubtotalCents, args.currencyCode),
    shipping_total: formatCents(shippingTotalCents, args.currencyCode),
    discount_total:
      discountTotalCents > 0
        ? formatCents(discountTotalCents, args.currencyCode)
        : undefined,
    tax_total:
      taxTotalCents > 0
        ? formatCents(taxTotalCents, args.currencyCode)
        : undefined,
    gross_total: formatCents(grossTotalCents, args.currencyCode)
  } as const;

  return {
    itemsSubtotalCents,
    shippingTotalCents,
    discountTotalCents,
    taxTotalCents,
    grossTotalCents,
    receiptDetailsV2,
    amountsModel
  };
}

/**
 * Handle a duplicate order detected during webhook processing.
 *
 * This function:
 * 1. Backfills missing Stripe fees and receipt URL if needed
 * 2. Adjusts inventory if not already adjusted
 * 3. Marks the event as processed
 *
 * @param args.existing - The existing order document
 * @param args.event - The Stripe webhook event
 * @param args.accountId - The Stripe connected account ID
 * @param args.payloadInstance - Payload CMS instance
 * @param args.readStripeFeesAndReceiptUrl - Function to read Stripe fees and receipt URL
 * @param args.decrementInventoryBatch - Function to decrement inventory for a batch of products
 */
export async function handleDuplicateOrder(args: {
  existing: ExistingOrderPrecheck;
  event: Stripe.Event;
  accountId: string;
  payloadInstance: import('payload').Payload;
  readStripeFeesAndReceiptUrl: (args: {
    stripeAccountId: string;
    paymentIntentId?: string | null;
    chargeId?: string | null;
  }) => Promise<{
    stripeFeeCents: number;
    platformFeeCents: number;
    receiptUrl: string | null;
  }>;
  decrementInventoryBatch: (args: {
    payload: import('payload').Payload;
    qtyByProductId: Map<string, number>;
  }) => Promise<void>;
}): Promise<void> {
  const {
    existing,
    event,
    accountId,
    payloadInstance,
    readStripeFeesAndReceiptUrl,
    decrementInventoryBatch
  } = args;

  console.log('[webhook] dup-precheck hit (before)', {
    orderId: existing.id,
    hasItems: Array.isArray(existing.items),
    itemsCount: Array.isArray(existing.items) ? existing.items.length : 0,
    inventoryAdjustedAt: existing.inventoryAdjustedAt ?? null
  });

  // ─────────────────────────────────────────────────────────────
  // Backfill Stripe fees & receipt if missing on duplicates
  // (preserve explicit zeros by checking for null/undefined)
  // ─────────────────────────────────────────────────────────────
  try {
    const stripeFeePresent = existing.amounts?.stripeFeeCents != null; // preserves 0
    const platformFeePresent = existing.amounts?.platformFeeCents != null; // preserves 0
    const receiptPresent = existing.documents?.receiptUrl != null; // string or null (present)

    let feesResult: {
      stripeFeeCents: number;
      platformFeeCents: number;
      receiptUrl: string | null;
    } | null = null;

    if (!stripeFeePresent || !platformFeePresent || !receiptPresent) {
      const paymentIntentId = existing.stripePaymentIntentId ?? null;
      const chargeId = existing.stripeChargeId ?? null;

      feesResult = await readStripeFeesAndReceiptUrl({
        stripeAccountId: accountId,
        paymentIntentId,
        chargeId
      });
    }

    type AmountsShape = {
      subtotalCents?: number | null;
      taxTotalCents?: number | null;
      shippingTotalCents?: number | null;
      discountTotalCents?: number | null;
      platformFeeCents?: number | null;
      stripeFeeCents?: number | null;
      sellerNetCents?: number | null;
    };

    const existingAmounts = (existing.amounts ?? {}) as AmountsShape;

    const updateData: {
      amounts?: AmountsShape;
      documents?: { receiptUrl: string | null };
      stripeEventId: string;
    } = { stripeEventId: event.id };

    let contextFees:
      | {
          ahSystem: true;
          fees: {
            platformFeeCents?: number;
            stripeFeeCents?: number;
          };
        }
      | undefined;

    if (feesResult) {
      updateData.amounts = {
        ...existingAmounts,
        stripeFeeCents: stripeFeePresent
          ? existingAmounts.stripeFeeCents!
          : feesResult.stripeFeeCents,
        platformFeeCents: platformFeePresent
          ? existingAmounts.platformFeeCents!
          : feesResult.platformFeeCents
      };

      // Pass trusted fees so lockAndCalculateAmounts prefers them
      contextFees = {
        ahSystem: true as const,
        fees: {
          platformFeeCents: updateData.amounts.platformFeeCents ?? undefined,
          stripeFeeCents: updateData.amounts.stripeFeeCents ?? undefined
        }
      };
    }

    if (!receiptPresent && feesResult) {
      updateData.documents = { receiptUrl: feesResult.receiptUrl };
    }

    if (updateData.amounts || updateData.documents) {
      await payloadInstance.update({
        collection: 'orders',
        id: existing.id,
        data: updateData,
        overrideAccess: true,
        ...(contextFees ? { context: contextFees } : {})
      });
    }
  } catch (backfillError) {
    console.warn('[webhook] duplicate path backfill failed', backfillError);
  }

  // inventory adjust on dup path (unchanged)
  if (!existing.inventoryAdjustedAt && Array.isArray(existing.items)) {
    const quantityByProductId = toQtyMap(
      (existing.items ?? [])
        .map((item) => {
          const relation = item.product as unknown;
          let product: string | null = null;

          if (typeof relation === 'string' && relation.length > 0) {
            product = relation;
          } else if (
            relation &&
            typeof relation === 'object' &&
            'id' in relation
          ) {
            const relationId = (relation as { id?: unknown }).id;
            if (typeof relationId === 'string' && relationId.length > 0) {
              product = relationId;
            }
          }

          if (!product) return null;
          return {
            product,
            quantity:
              typeof item.quantity === 'number' &&
              Number.isInteger(item.quantity)
                ? item.quantity
                : 1
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
    console.log('[webhook] duplicate path: inventory already adjusted', {
      orderId: existing.id
    });
  }
}
