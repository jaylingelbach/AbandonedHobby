import type Stripe from 'stripe';
import { OrderItem } from '../library/ui/components/types';
import { assertPositiveInt } from '../orders/utils';
import {
  EngineOptions,
  LineSelection,
  LocalRefundStatus,
  OrderLike,
  StripeRefundReason
} from './types';
import crypto from 'node:crypto';
import type { Payload } from 'payload';

/**
 * Creates a map of OrderItem keyed by each item's non-empty string `id`.
 *
 * @param items - Array of OrderItem; items with a missing, non-string, or empty `id` are omitted
 * @returns A Map where keys are item `id` values and values are the corresponding OrderItem
 */
export function toMapById(items: OrderItem[]): Map<string, OrderItem> {
  const newMap = new Map<string, OrderItem>();
  for (const item of items) {
    if (typeof item.id === 'string' && item.id) newMap.set(item.id, item);
  }
  return newMap;
}

/**
 * Builds a stable idempotency key for a refund request based on order data and options.
 *
 * @param orderId - The identifier of the order the refund targets
 * @param selections - The line selections included in the refund
 * @param options - Optional engine options that influence the refund payload
 * @returns A hex-encoded SHA-256 digest of the string `refund:v1:` concatenated with the JSON payload of `{ orderId, selections, options }`
 */
export function buildIdempotencyKey(
  orderId: string,
  selections: LineSelection[],
  options?: EngineOptions
): string {
  const payload = JSON.stringify({ orderId, selections, options });
  return crypto
    .createHash('sha256')
    .update(`refund:v1:${payload}`)
    .digest('hex');
}

/**
 * Calculate the total refund amount in cents for the given order and line selections.
 *
 * Validates that each selection references an existing order item and that quantities are positive integers and do not exceed the purchased quantity. When an item contains an `amountTotal`, that per-line total is used (to reflect discounts/taxes); otherwise the function derives a unit amount from `unitAmount` or `amountTotal` and prorates the refund by the selected quantity.
 *
 * @param order - The order-like object containing `items` (each item should include `id`, optional `quantity`, optional `unitAmount`, and optional `amountTotal`).
 * @param selections - Array of line selections, each specifying `itemId` and `quantity` to refund.
 * @returns The total refundable amount in cents.
 * @throws If a selection references a missing item, if any quantity is not a positive integer, or if a selection's quantity exceeds the item's purchased quantity.
 */
export function computeRefundAmountCents(
  order: OrderLike,
  selections: LineSelection[]
): number {
  const items = Array.isArray(order.items) ? order.items : [];
  const byId = toMapById(items);

  let sum = 0;

  for (const sel of selections) {
    const src = byId.get(sel.itemId);
    if (!src) throw new Error(`Item not found: ${sel.itemId}`);
    const originalQty = assertPositiveInt(src.quantity ?? 1, 'item.quantity');
    const unitBase =
      typeof src.unitAmount === 'number'
        ? src.unitAmount
        : Math.round((src.amountTotal ?? 0) / originalQty);
    // Prefer true per-line totals if present (includes discounts/taxes)
    const lineTotal =
      typeof src.amountTotal === 'number'
        ? src.amountTotal
        : unitBase * originalQty;

    const qtySelected = assertPositiveInt(sel.quantity, 'selection.quantity');
    if (qtySelected > originalQty) {
      throw new Error(
        `selection.quantity exceeds purchased quantity for item ${sel.itemId}`
      );
    }
    sum += Math.round((lineTotal * qtySelected) / originalQty);
  }
  return sum;
}

/**
 * Converts a domain refund reason to a Stripe-supported refund reason.
 *
 * If `reason` is 'requested_by_customer', 'duplicate', or 'fraudulent', returns that value; otherwise returns `undefined`.
 *
 * @param reason - Optional domain refund reason to convert.
 * @returns The matching Stripe refund reason, or `undefined` if the input is 'other' or not recognized.
 */
export function toStripeRefundReason(
  reason?: StripeRefundReason
): Stripe.RefundCreateParams.Reason | undefined {
  if (
    reason === 'requested_by_customer' ||
    reason === 'duplicate' ||
    reason === 'fraudulent'
  ) {
    return reason;
  }
  return undefined; // 'other' (and any unknown) not allowed by Stripe
}

/**
 * Normalize a refund status string to a LocalRefundStatus value.
 *
 * @param status - The input status; expected values are 'succeeded', 'pending', 'failed', 'canceled', or `null`.
 * @returns `'succeeded'`, `'pending'`, `'failed'`, or `'canceled'` matching the input status; returns `'pending'` for `null` or any unrecognized value.
 */
export function toLocalRefundStatus(status: string | null): LocalRefundStatus {
  switch (status) {
    case 'succeeded':
    case 'pending':
    case 'failed':
    case 'canceled':
      return status;
    default:
      return 'pending'; // safe default for unexpected/temporary values
  }
}

/**
 * Builds a deterministic idempotency key for a refund request using a normalized payload.
 *
 * The payload includes the orderId, a stable sort of selections, and a normalized subset of options
 * (only `reason`, `restockingFeeCents`, and `refundShippingCents`); free-text fields like notes are
 * intentionally excluded so they do not affect the key.
 *
 * @param input - Object containing `orderId`, `selections`, and optional `options` used to construct the key.
 * @returns A hex-encoded SHA-256 hash string representing the idempotency key prefixed with `refund:v2:`.
 */
export function buildIdempotencyKeyV2(input: {
  orderId: string;
  selections: LineSelection[];
  options?: EngineOptions;
}): string {
  const sortedSelections = [...input.selections].sort(
    (a, b) => a.itemId.localeCompare(b.itemId) || a.quantity - b.quantity
  );

  const o = input.options ?? {};
  const normalizedOptions = {
    // include only fields that should affect idempotency
    reason: o.reason ?? null,
    restockingFeeCents:
      typeof o.restockingFeeCents === 'number' ? o.restockingFeeCents : 0,
    refundShippingCents:
      typeof o.refundShippingCents === 'number' ? o.refundShippingCents : 0
    // notes intentionally omitted so free-text doesn’t alter the key
  };

  const payload = JSON.stringify({
    orderId: input.orderId,
    selections: sortedSelections,
    options: normalizedOptions
  });

  return crypto
    .createHash('sha256')
    .update(`refund:v2:${payload}`)
    .digest('hex');
}

/**
 * Detects whether an error represents a MongoDB write conflict.
 *
 * @param err - The error object to inspect
 * @returns `true` if the error indicates a write conflict (MongoDB code `112` or message contains "Write conflict"), `false` otherwise
 */
function isWriteConflict(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  const msg = String((err as { message?: string } | null)?.message ?? '');
  return code === 112 || msg.includes('Write conflict');
}

/**
 * Detects whether an error represents a disconnected MongoDB client.
 *
 * @param err - The value to inspect for a MongoDB not-connected condition
 * @returns `true` if the error indicates the MongoDB client is not connected, `false` otherwise
 */
function isNotConnected(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  const msg = String((err as { message?: string } | null)?.message ?? '');
  return name === 'MongoNotConnectedError' || msg.includes('must be connected');
}

/**
 * Delay execution for the specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to wait.
 * @returns A promise that resolves to `undefined` when the delay completes.
 */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Recompute an order's refunded total (in cents), last refund timestamp, and derived order status from stored refunds.
 *
 * If computed values differ from the order record, the order document is updated. The operation will retry on transient
 * conditions such as Mongo write conflicts and can optionally obtain a fresh Payload instance when the provided one is
 * disconnected.
 *
 * @param opts.payload - Data access Payload used to read refunds and update the order
 * @param opts.orderId - ID of the order to recompute
 * @param opts.includePending - If true, include refunds with status `pending` in the aggregation; otherwise only include `succeeded`
 * @param opts.getFreshPayload - Optional factory to obtain a new Payload when the current one is not connected
 */
export async function recomputeRefundState(opts: {
  payload: Payload;
  orderId: string;
  includePending?: boolean;
  /** Optional factory to obtain a fresh Payload instance when the given one is disconnected. */
  getFreshPayload?: () => Promise<Payload>;
}): Promise<void> {
  const { orderId, includePending = false } = opts;

  let payload: Payload = opts.payload;
  const MAX_TRIES = 5;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      // 1) Load order
      const order = (await payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true
      })) as {
        id: string;
        total: number;
        status: 'paid' | 'partially_refunded' | 'refunded' | 'canceled';
        refundedTotalCents?: number | null;
        lastRefundAt?: string | null;
      } | null;

      if (!order?.id) return;

      // 2) Gather refunds
      const counted = includePending ? ['succeeded', 'pending'] : ['succeeded'];
      const { docs } = await payload.find({
        collection: 'refunds',
        where: {
          and: [{ order: { equals: orderId } }, { status: { in: counted } }]
        },
        pagination: false,
        depth: 0,
        overrideAccess: true
      });

      const refunds = docs as Array<{
        amount?: number | null;
        createdAt?: string;
        updatedAt?: string;
      }>;

      const refundedTotalCents = refunds.reduce(
        (sum, r) => sum + (r.amount ?? 0),
        0
      );

      const lastRefundAtMs = refunds.reduce<number>((max, r) => {
        const ts = new Date(r.updatedAt ?? r.createdAt ?? 0).getTime();
        return Number.isFinite(ts) ? Math.max(max, ts) : max;
      }, 0);
      const lastRefundAt =
        lastRefundAtMs > 0 ? new Date(lastRefundAtMs).toISOString() : null;

      // 3) Next status (don’t clobber 'canceled')
      let nextStatus = order.status;
      if (order.status !== 'canceled') {
        if (refundedTotalCents <= 0) nextStatus = 'paid';
        else if (refundedTotalCents >= (order.total ?? 0))
          nextStatus = 'refunded';
        else nextStatus = 'partially_refunded';
      }

      // 4) Avoid noisy writes
      const changed =
        (order.refundedTotalCents ?? 0) !== refundedTotalCents ||
        (order.lastRefundAt ?? null) !== lastRefundAt ||
        order.status !== nextStatus;

      if (!changed) return;

      await payload.update({
        collection: 'orders',
        id: orderId,
        data: { refundedTotalCents, lastRefundAt, status: nextStatus },
        overrideAccess: true
      });

      return; // success
    } catch (err) {
      // If the client was disconnected, optionally get a fresh instance and retry
      if (isNotConnected(err) && opts.getFreshPayload) {
        try {
          payload = await opts.getFreshPayload();
          await sleep(25);
          continue;
        } catch (e) {
          console.warn('[refunds] getFreshPayload failed', e);
          return; // give up quietly
        }
      }

      // Retry write conflicts with backoff
      if (isWriteConflict(err) && attempt < MAX_TRIES) {
        await sleep(50 * attempt);
        continue;
      }

      console.warn('[refunds] recomputeRefundState failed', {
        orderId,
        attempt,
        err
      });
      return;
    }
  }
  console.warn('[refunds] recomputeRefundState exhausted retries', {
    orderId,
    maxTries: MAX_TRIES
  });
}
