import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';

export const runtime = 'nodejs';

// GET /api/admin/refunds/remaining?orderId=...&includePending=true
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId')?.toString();
    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    const includePending = searchParams.get('includePending') === 'true';

    const payload = await getPayload({ config });
    const payloadReq = req as unknown as PayloadRequest;
    const { user } = await payload.auth({
      req: payloadReq,
      headers: req.headers,
    });

    const isStaff =
      Array.isArray(user?.roles) && user.roles.includes('super-admin');
    if (!isStaff) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Load order
    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })) as {
      id: string;
      items?: Array<{ id?: string; quantity?: number }>;
      total?: number;
      refundedTotalCents?: number;
    } | null;

    if (!order?.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Collect refunds for the order
    const counted = includePending ? ['succeeded', 'pending'] : ['succeeded'];
    const { docs } = await payload.find({
      collection: 'refunds',
      where: {
        and: [{ order: { equals: orderId } }, { status: { in: counted } }],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });

    // Aggregate refunded quantities across ALL refund docs
    const refundedQtyByItemId = new Map<string, number>();
    for (const doc of docs as Array<{
      selections?: Array<{ itemId: string; quantity: number }>;
    }>) {
      for (const selection of doc.selections ?? []) {
        if (!selection?.itemId) continue;
        refundedQtyByItemId.set(
          selection.itemId,
          (refundedQtyByItemId.get(selection.itemId) ?? 0) +
            (selection.quantity ?? 0)
        );
      }
    }

    // Compute remaining qty per itemId (after aggregating)
    const byItemId: Record<string, number> = {};
    for (const item of order.items ?? []) {
      if (!item?.id) continue;
      const purchased = Number.isFinite(item.quantity)
        ? (item.quantity as number)
        : 1;
      const already = refundedQtyByItemId.get(String(item.id)) ?? 0;
      byItemId[String(item.id)] = Math.max(0, purchased - already);
    }

    // Order-level remaining (uses stored totals)
    const remainingCents = Math.max(
      0,
      (order.total ?? 0) - (order.refundedTotalCents ?? 0)
    );

    return NextResponse.json({ ok: true, byItemId, remainingCents });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
