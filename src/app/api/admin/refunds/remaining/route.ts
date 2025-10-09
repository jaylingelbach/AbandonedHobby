import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';

export const runtime = 'nodejs';

/**
 * GET /api/admin/refunds/remaining?orderId=...&includePending=true|false
 *
 * Returns:
 * {
 *   ok: true,
 *   byItemId: { [itemId]: remainingQty },
 *   remainingCents: number,
 *   refundedAmountByItemId: { [itemId]: cents }   // NEW
 * }
 */
export async function GET(req: NextRequest) {
  type SelBlockQuantity = {
    blockType: 'quantity';
    itemId: string;
    quantity: number;
  };
  type SelBlockAmount = {
    blockType: 'amount';
    itemId: string;
    amountCents?: number;
    amount?: number;
  };
  type SelLegacyQty = { itemId: string; quantity: number }; // no blockType
  type SelLegacyAmount = {
    itemId: string;
    amountCents?: number;
    amount?: number;
  }; // no blockType

  function isObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
  }

  function isString(x: unknown): x is string {
    return typeof x === 'string';
  }

  function isFiniteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
  }

  function isBlockQuantity(sel: unknown): sel is SelBlockQuantity {
    return (
      isObject(sel) &&
      sel['blockType'] === 'quantity' &&
      isString(sel['itemId']) &&
      isFiniteNumber(sel['quantity'])
    );
  }

  function isBlockAmount(sel: unknown): sel is SelBlockAmount {
    return (
      isObject(sel) &&
      sel['blockType'] === 'amount' &&
      isString(sel['itemId']) &&
      (isFiniteNumber(sel['amountCents']) || isFiniteNumber(sel['amount']))
    );
  }

  function isLegacyQty(sel: unknown): sel is SelLegacyQty {
    return (
      isObject(sel) &&
      isString(sel['itemId']) &&
      isFiniteNumber(sel['quantity']) &&
      !('blockType' in sel)
    );
  }

  function isLegacyAmount(sel: unknown): sel is SelLegacyAmount {
    return (
      isObject(sel) &&
      isString(sel['itemId']) &&
      (isFiniteNumber(sel['amountCents']) || isFiniteNumber(sel['amount'])) &&
      !('blockType' in sel)
    );
  }

  function pickAmountCents(sel: SelBlockAmount | SelLegacyAmount): number {
    if (isFiniteNumber(sel.amountCents))
      return Math.trunc(sel.amountCents as number);
    if (isFiniteNumber(sel.amount)) return Math.trunc(sel.amount as number);
    return 0;
  }

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
      headers: req.headers
    });

    const isStaff =
      Array.isArray(user?.roles) && user.roles.includes('super-admin');
    if (!isStaff) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true
    })) as {
      id: string;
      total?: number;
      refundedTotalCents?: number;
      items?: Array<{ id?: string; quantity?: number }>;
    } | null;

    if (!order?.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

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

    // ---- Order-level remaining cents
    const refundedCentsFromDocs = (docs as Array<{ amount?: unknown }>).reduce(
      (sum, doc) => {
        const numeric =
          typeof doc.amount === 'number' ? doc.amount : Number(doc.amount);
        return sum + (Number.isFinite(numeric) ? Math.trunc(numeric) : 0);
      },
      0
    );

    const remainingCentsFromDocs = Math.max(
      0,
      (order.total ?? 0) - refundedCentsFromDocs
    );
    const remainingCentsFromOrderCol = Math.max(
      0,
      (order.total ?? 0) - (order.refundedTotalCents ?? 0)
    );

    const remainingCents =
      refundedCentsFromDocs > 0
        ? remainingCentsFromDocs
        : remainingCentsFromOrderCol;

    // ---- Per-item remaining quantities (legacy + blocks) + refunded amounts
    const refundedQtyByItemId = new Map<string, number>();
    const refundedAmountByItemId = new Map<string, number>();

    function addQty(itemId: string, quantity: number) {
      if (!itemId || quantity <= 0) return;
      refundedQtyByItemId.set(
        itemId,
        (refundedQtyByItemId.get(itemId) ?? 0) + Math.trunc(quantity)
      );
    }
    function addAmount(itemId: string, cents: number) {
      if (!itemId || cents <= 0) return;
      refundedAmountByItemId.set(
        itemId,
        (refundedAmountByItemId.get(itemId) ?? 0) + Math.trunc(cents)
      );
    }

    for (const doc of docs as Array<{
      selections?: unknown[];
      amount?: number;
    }>) {
      const rawSelections = Array.isArray(doc.selections) ? doc.selections : [];

      let foundAnyPerLineAmount = false;
      let singleItemId: string | null = null;
      let uniqueItemSeen = false;

      for (const sel of rawSelections) {
        if (isBlockQuantity(sel)) {
          addQty(sel.itemId, Math.trunc(sel.quantity));
          // track uniqueness
          if (singleItemId === null) {
            singleItemId = sel.itemId;
            uniqueItemSeen = true;
          } else if (singleItemId !== sel.itemId) {
            uniqueItemSeen = false;
          }
          continue;
        }
        if (isBlockAmount(sel)) {
          addAmount(sel.itemId, pickAmountCents(sel));
          foundAnyPerLineAmount = true;
          if (singleItemId === null) {
            singleItemId = sel.itemId;
            uniqueItemSeen = true;
          } else if (singleItemId !== sel.itemId) {
            uniqueItemSeen = false;
          }
          continue;
        }
        if (isLegacyQty(sel)) {
          addQty(sel.itemId, Math.trunc(sel.quantity));
          if (singleItemId === null) {
            singleItemId = sel.itemId;
            uniqueItemSeen = true;
          } else if (singleItemId !== sel.itemId) {
            uniqueItemSeen = false;
          }
          continue;
        }
        if (isLegacyAmount(sel)) {
          addAmount(sel.itemId, pickAmountCents(sel));
          foundAnyPerLineAmount = true;
          if (singleItemId === null) {
            singleItemId = sel.itemId;
            uniqueItemSeen = true;
          } else if (singleItemId !== sel.itemId) {
            uniqueItemSeen = false;
          }
          continue;
        }
      }

      // Fallback:
      // If there were NO per-line amount entries in selections,
      // but there is exactly one unique item referenced, attribute the doc.amount to that item.
      if (
        !foundAnyPerLineAmount &&
        uniqueItemSeen &&
        typeof doc.amount === 'number' &&
        doc.amount > 0
      ) {
        addAmount(singleItemId as string, Math.trunc(doc.amount));
      }
    }

    const byItemId: Record<string, number> = {};
    for (const item of order.items ?? []) {
      const id = item?.id?.toString();
      if (!id) continue;
      const purchased = Number.isFinite(item.quantity)
        ? (item.quantity as number)
        : 1;
      const already = refundedQtyByItemId.get(id) ?? 0;
      byItemId[id] = Math.max(0, purchased - already);
    }

    // materialize maps → plain objects
    const refundedQtyByItemIdObj: Record<string, number> = {};
    for (const [id, qty] of refundedQtyByItemId)
      refundedQtyByItemIdObj[id] = qty;

    const refundedAmountByItemIdObj: Record<string, number> = {};
    for (const [id, cents] of refundedAmountByItemId)
      refundedAmountByItemIdObj[id] = cents;

    return NextResponse.json({
      ok: true,
      byItemId,
      remainingCents,
      refundedQtyByItemId: refundedQtyByItemIdObj,
      refundedAmountByItemId: refundedAmountByItemIdObj
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
