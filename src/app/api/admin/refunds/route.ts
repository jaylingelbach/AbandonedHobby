import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';
import { createRefundForOrder } from '@/modules/refunds/engine';
import {
  ExceedsRefundableError,
  FullyRefundedError
} from '@/modules/refunds/errors';
import { refundRequestSchema } from './schema';
import { recomputeRefundState } from '@/modules/refunds/utils';

export const runtime = 'nodejs';

/**
 * Create a refund for an order via the admin API.
 *
 * Validates the request body, requires the authenticated user to have the `super-admin` role, creates the refund, and attempts to recompute refund state before returning the created refund details.
 *
 * @param req - Incoming Next.js request containing the refund payload (orderId, selections, and refund options)
 * @returns On success, an object `{ ok: true, stripeRefundId, status, amount, refundId }`. On validation failure returns status 400 with `{ error: 'Invalid request body', details: { fieldErrors, formErrors } }`. If the user is not authorized returns status 403 with `{ error: 'FORBIDDEN' }`. If the order is already fully refunded returns status 409 with `{ error: string, code: 'ALREADY_FULLY_REFUNDED', orderId }`. If the refund exceeds remaining refundable amount returns status 409 with `{ error: string, code: 'EXCEEDS_REMAINING', orderId }`. On other failures returns status 500 with `{ error: string }`.
 */
export async function POST(req: NextRequest) {
  console.log('hit /api/admin/refunds');

  try {
    const body = await req.json();
    const parsed = refundRequestSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, formErrors } = parsed.error.flatten();
      return NextResponse.json(
        { error: 'Invalid request body', details: { fieldErrors, formErrors } },
        { status: 400 }
      );
    }

    // use safe data in createRefundOrder instead of body.
    const input = parsed.data;

    const payload = await getPayload({ config });
    const payloadReq = req as unknown as PayloadRequest;
    const { user } = await payload.auth({
      req: payloadReq,
      headers: req.headers
    });

    const roles = Array.isArray(user?.roles) ? user!.roles : [];
    const isStaff = roles.includes('super-admin');
    if (!isStaff) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { refund, record } = await createRefundForOrder({
      payload,
      orderId: input.orderId,
      selections: input.selections,
      options: {
        reason: input.reason,
        restockingFeeCents: input.restockingFeeCents,
        refundShippingCents: input.refundShippingCents,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey
      }
    });

    try {
      await recomputeRefundState({
        payload,
        orderId: input.orderId,
        includePending: true,
        getFreshPayload: async () => getPayload({ config }) // fallback if disconnected
      });
    } catch (error) {
      console.warn('[admin] recomputeRefundState failed (non-fatal)', error);
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
