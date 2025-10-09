import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';
import { createRefundForOrder } from '@/modules/refunds/engine';
import {
  ExceedsRefundableError,
  FullyRefundedError
} from '@/modules/refunds/errors';
import { recomputeRefundState } from '@/modules/refunds/utils';

// ✅ import from schema.ts
import {
  refundRequestSchema,
  type RefundRequest,
  type ApiLineSelection
} from './schema';

// engine selection type (no `type` field)
import type { LineSelection } from '@/modules/refunds/types';

export const runtime = 'nodejs';

function toEngineSelections(
  apiSelections: ApiLineSelection[]
): LineSelection[] {
  return apiSelections.map((s) =>
    s.type === 'amount'
      ? { itemId: s.itemId, amountCents: Math.trunc(s.amountCents) }
      : { itemId: s.itemId, quantity: Math.trunc(s.quantity) }
  );
}

export async function POST(req: NextRequest) {
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

    const input: RefundRequest = parsed.data;

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

    // 🔁 Adapt API selections (with `type`) → engine selections (no `type`)
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

    try {
      await recomputeRefundState({
        payload,
        orderId: input.orderId,
        includePending: true,
        getFreshPayload: async () => getPayload({ config })
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
