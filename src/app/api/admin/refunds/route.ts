import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';
import { createRefundForOrder } from '@/modules/refunds/engine';
import {
  ExceedsRefundableError,
  FullyRefundedError
} from '@/modules/refunds/errors';
import { recomputeRefundState } from '@/modules/refunds/utils';
import {
  refundRequestSchema,
  type RefundRequest,
  type ApiLineSelection
} from './schema';

import type { LineSelection } from '@/modules/refunds/types';

export const runtime = 'nodejs';

// --- Types used for persisting selections on the refund record ---
type PersistedSelectionQuantity = {
  blockType: 'quantity';
  itemId: string;
  quantity: number;
};

type PersistedSelectionAmount = {
  blockType: 'amount';
  itemId: string;
  amountCents: number;
};

type PersistedSelection = PersistedSelectionQuantity | PersistedSelectionAmount;

type OrderForShippingCheck = {
  id: string;
  amounts?: {
    shippingTotalCents?: number | null;
  };
};

type RefundForShippingAggregation = {
  fees?: {
    refundShippingCents?: number | null;
  };
};

/**
 * Normalize API selection objects into engine-compatible line selections.
 *
 * Converts each API selection into a LineSelection, ensuring numeric values are truncated to integers suitable for the refund engine.
 *
 * @param apiSelections - Array of user-provided line selections from the API
 * @returns An array of line selections where each entry contains `itemId` and either `amountCents` (truncated integer) or `quantity` (truncated integer)
 */
function toEngineSelections(
  apiSelections: ApiLineSelection[]
): LineSelection[] {
  return apiSelections.map((selection) =>
    selection.type === 'amount'
      ? {
          itemId: selection.itemId,
          amountCents: Math.trunc(selection.amountCents)
        }
      : {
          itemId: selection.itemId,
          quantity: Math.trunc(selection.quantity)
        }
  );
}

/**
 * Convert API line selections into normalized persisted selection objects for storage.
 *
 * Numeric selection values are truncated to integers and each selection is mapped
 * to a persisted shape with `blockType` set to either `'amount'` or `'quantity'`.
 *
 * @param apiSelections - The array of API-facing line selections to normalize
 * @returns An array of persisted selection objects with integer `amountCents` or `quantity` and the corresponding `blockType`
 */
function toPersistedSelections(
  apiSelections: ApiLineSelection[]
): PersistedSelection[] {
  return apiSelections.map((selection) =>
    selection.type === 'amount'
      ? {
          blockType: 'amount',
          itemId: selection.itemId,
          amountCents: Math.trunc(selection.amountCents)
        }
      : {
          blockType: 'quantity',
          itemId: selection.itemId,
          quantity: Math.trunc(selection.quantity)
        }
  );
}

/**
 * Convert an input to a non-negative integer, returning a fallback when conversion is not possible.
 *
 * The function truncates any fractional part of a finite number and returns it if it is greater than or equal to zero; otherwise it returns `fallback`.
 *
 * @param value - The value to convert to a non-negative integer
 * @param fallback - The value to return when `value` is not a finite number or truncates to a negative integer (default: `0`)
 * @returns A non-negative integer derived from `value`, or `fallback` when conversion is not applicable
 */
function toSafeNonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  return integer >= 0 ? integer : fallback;
}

/**
 * Handle an admin POST request to create a refund for an order, validate input, enforce server-side shipping refund limits, invoke the refund engine, persist normalized selections (non-fatal), and trigger a recompute of refund state (non-fatal).
 *
 * Performs:
 * - request body validation,
 * - super-admin authorization,
 * - shipping-amount guard that prevents refunding more shipping than remains refundable,
 * - creation of the refund via the refund engine,
 * - best-effort persistence of normalized selections and recompute of refund state.
 *
 * @returns A NextResponse with JSON. On success: `{ ok: true, stripeRefundId, status, amount, refundId }`. On failure: an error object `{ error }` and, when applicable, `{ code, orderId }` (validation failures include `details` with `fieldErrors`/`formErrors`).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ---------- Parse and validate body ----------
    const rawBody = await request.json();
    const parsedResult = refundRequestSchema.safeParse(rawBody);

    if (!parsedResult.success) {
      const { fieldErrors, formErrors } = parsedResult.error.flatten();
      return NextResponse.json(
        { error: 'Invalid request body', details: { fieldErrors, formErrors } },
        { status: 400 }
      );
    }

    const input: RefundRequest = parsedResult.data;

    // ---------- Auth ----------
    const payload = await getPayload({ config });
    const payloadRequest = request as unknown as PayloadRequest;

    const { user } = await payload.auth({
      req: payloadRequest,
      headers: request.headers
    });

    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const isStaff = roles.includes('super-admin');
    if (!isStaff) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // ---------- Shipping guard (server-side) ----------
    // Only run the guard when the client is attempting to refund shipping.
    const requestedShippingCentsRaw = input.refundShippingCents;
    const requestedShippingCents =
      typeof requestedShippingCentsRaw === 'number'
        ? toSafeNonNegativeInteger(requestedShippingCentsRaw, 0)
        : 0;

    if (requestedShippingCents > 0) {
      // 1) Load order with shipping amounts
      const order = (await payload.findByID({
        collection: 'orders',
        id: input.orderId,
        depth: 0,
        overrideAccess: true
      })) as OrderForShippingCheck | null;

      if (!order?.id) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const originalShippingCents = toSafeNonNegativeInteger(
        order.amounts?.shippingTotalCents ?? 0,
        0
      );

      // If the order had no shipping charged, we must prevent any shipping refund.
      if (originalShippingCents <= 0) {
        return NextResponse.json(
          {
            error:
              'No shipping was charged on this order; shipping cannot be refunded.',
            code: 'EXCEEDS_REMAINING',
            orderId: input.orderId
          },
          { status: 409 }
        );
      }

      // 2) Load existing refunds and sum shipping already refunded (succeeded + pending)
      const refundQueryResult = await payload.find({
        collection: 'refunds',
        where: {
          and: [
            { order: { equals: input.orderId } },
            { status: { in: ['succeeded', 'pending'] } }
          ]
        },
        pagination: false,
        depth: 0,
        overrideAccess: true
      });

      const existingRefunds: RefundForShippingAggregation[] = Array.isArray(
        refundQueryResult.docs
      )
        ? (refundQueryResult.docs as RefundForShippingAggregation[])
        : [];

      const alreadyRefundedShippingCents = existingRefunds.reduce(
        (runningTotal, refundDocument) => {
          const feesGroup = refundDocument.fees;
          const shippingPortion = toSafeNonNegativeInteger(
            feesGroup?.refundShippingCents ?? 0,
            0
          );
          return runningTotal + shippingPortion;
        },
        0
      );

      const remainingShippingCents = Math.max(
        0,
        originalShippingCents - alreadyRefundedShippingCents
      );

      if (requestedShippingCents > remainingShippingCents) {
        const exceededBy = requestedShippingCents - remainingShippingCents;
        return NextResponse.json(
          {
            error: `Requested shipping refund exceeds remaining refundable shipping by ${exceededBy} cents.`,
            code: 'EXCEEDS_REMAINING',
            orderId: input.orderId,
            remainingShippingCents
          },
          { status: 409 }
        );
      }

      // If it is within limit, we still normalize to a non-negative integer before engine
      input.refundShippingCents = requestedShippingCents;
    }

    // ---------- Engine call ----------
    const engineSelections = toEngineSelections(input.selections);

    const { refund, record } = await createRefundForOrder({
      payload,
      orderId: input.orderId,
      selections: engineSelections,
      options: {
        reason: input.reason,
        restockingFeeCents: input.restockingFeeCents,
        refundShippingCents: input.refundShippingCents,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey
      }
    });

    // Immediately persist normalized selections on the refund doc
    // so the "remaining" endpoint can attribute by-line deterministically.
    try {
      const normalizedSelections: PersistedSelection[] = toPersistedSelections(
        input.selections
      );
      await payload.update({
        collection: 'refunds',
        id: record.id,
        data: { selections: normalizedSelections },
        overrideAccess: true,
        depth: 0
      });
    } catch (persistError) {
      console.warn(
        '[admin] failed to persist normalized selections on refund (non-fatal)',
        persistError
      );
    }

    // Kick a recompute to make the GET /remaining reflect this refund ASAP
    try {
      await recomputeRefundState({
        payload,
        orderId: input.orderId,
        includePending: true,
        getFreshPayload: async () => getPayload({ config })
      });
    } catch (recomputeError) {
      console.warn(
        '[admin] recomputeRefundState failed (non-fatal)',
        recomputeError
      );
    }

    return NextResponse.json({
      ok: true,
      stripeRefundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      refundId: record.id
    });
  } catch (error: unknown) {
    if (error instanceof FullyRefundedError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'ALREADY_FULLY_REFUNDED',
          orderId: error.orderId
        },
        { status: 409 }
      );
    }

    if (error instanceof ExceedsRefundableError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'EXCEEDS_REMAINING',
          orderId: error.orderId
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}