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
 * Validates the request body, requires the authenticated user to have the `super-admin` role, creates a refund, attempts a non-fatal recomputation of refund state, and returns details of the created refund. On validation failure responds with 400 and validation details; if the user is not authorized responds with 403; if the order is already fully refunded or the requested refund exceeds the remaining refundable amount responds with 409 and a specific code; other failures respond with 500 and an error message.
 *
 * @param req - Incoming Next.js request containing the refund request body (orderId, selections, and refund options)
 * @returns An object with `ok: true`, `stripeRefundId` (payment provider refund id), `status` (refund status), `amount` (refunded amount in cents), and `refundId` (internal refund record id)
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
