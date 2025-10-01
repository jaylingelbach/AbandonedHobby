import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';
import { createRefundForOrder } from '@/modules/refunds/engine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('hit /api/admin/refunds');
  try {
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
    const body = (await req.json()) as {
      orderId: string;
      selections: { itemId: string; quantity: number }[];
      reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other';
      restockingFeeCents?: number;
      refundShippingCents?: number;
      notes?: string;
    };

    const { refund, record } = await createRefundForOrder({
      payload,
      orderId: body.orderId,
      selections: body.selections,
      options: {
        reason: body.reason,
        restockingFeeCents: body.restockingFeeCents,
        refundShippingCents: body.refundShippingCents,
        notes: body.notes
      }
    });

    return NextResponse.json({
      ok: true,
      stripeRefundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      refundId: record.id
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`message: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
