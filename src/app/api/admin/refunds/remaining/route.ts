import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';

export const runtime = 'nodejs';

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
  type SelLegacyQty = { itemId: string; quantity: number };
  type SelLegacyAmount = {
    itemId: string;
    amountCents?: number;
    amount?: number;
  };

  const isObj = (x: unknown): x is Record<string, unknown> =>
    typeof x === 'object' && x !== null;
  const isStr = (x: unknown): x is string => typeof x === 'string';
  const isNum = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x);

  const isBlockQty = (sel: unknown): sel is SelBlockQuantity =>
    isObj(sel) &&
    sel['blockType'] === 'quantity' &&
    isStr(sel['itemId']) &&
    isNum(sel['quantity']);
  const isBlockAmt = (sel: unknown): sel is SelBlockAmount =>
    isObj(sel) &&
    sel['blockType'] === 'amount' &&
    isStr(sel['itemId']) &&
    (isNum(sel['amountCents']) || isNum(sel['amount']));
  const isLegacyQty = (sel: unknown): sel is SelLegacyQty =>
    isObj(sel) &&
    isStr(sel['itemId']) &&
    isNum(sel['quantity']) &&
    !('blockType' in sel);
  const isLegacyAmt = (sel: unknown): sel is SelLegacyAmount =>
    isObj(sel) &&
    isStr(sel['itemId']) &&
    (isNum(sel['amountCents']) || isNum(sel['amount'])) &&
    !('blockType' in sel);
  const pickAmountCents = (sel: SelBlockAmount | SelLegacyAmount): number =>
    isNum(sel.amountCents)
      ? Math.trunc(sel.amountCents)
      : isNum(sel.amount)
        ? Math.trunc(sel.amount)
        : 0;

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId')?.toString();
    if (!orderId)
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );

    const includePending = searchParams.get('includePending') === 'true';

    const payload = await getPayload({ config });
    const payloadReq = req as unknown as PayloadRequest;
    const { user } = await payload.auth({
      req: payloadReq,
      headers: req.headers
    });

    const isStaff =
      Array.isArray(user?.roles) && user.roles.includes('super-admin');
    if (!isStaff)
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    // ---- Load order (need item totals to decide full coverage by amount)
    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true
    })) as {
      id: string;
      total?: number;
      refundedTotalCents?: number;
      items?: Array<{
        id?: string;
        quantity?: number;
        unitAmount?: number;
        amountTotal?: number;
      }>;
    } | null;

    if (!order?.id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // ---- Fetch refunds
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

    // ---- Order-level remaining cents (for header)
    const refundedCentsFromDocs = (docs as Array<{ amount?: number }>).reduce(
      (sum, r) => sum + (typeof r.amount === 'number' ? r.amount : 0),
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

    // ---- Aggregate per-line qty + amount

    // ---- Aggregate per-line qty + amount
    const refundedQtyByItemId = new Map<string, number>();
    const refundedAmountByItemId = new Map<string, number>();

    const addQty = (idRaw: unknown, n: number) => {
      const id = idRaw == null ? '' : String(idRaw);
      if (!id || n <= 0) return;
      refundedQtyByItemId.set(
        id,
        (refundedQtyByItemId.get(id) ?? 0) + Math.trunc(n)
      );
    };

    const addAmt = (idRaw: unknown, cents: number) => {
      const id = idRaw == null ? '' : String(idRaw);
      if (!id || cents <= 0) return;
      refundedAmountByItemId.set(
        id,
        (refundedAmountByItemId.get(id) ?? 0) + Math.trunc(cents)
      );
    };

    for (const doc of docs as Array<{
      selections?: unknown[];
      amount?: number;
    }>) {
      const sels = Array.isArray(doc.selections) ? doc.selections : [];
      let foundAnyPerLineAmount = false;
      let singleItemId: string | null = null;
      let unique = true;

      for (const sel of sels) {
        if (isBlockQty(sel)) {
          const selId = String(sel.itemId);
          addQty(selId, sel.quantity);
          if (singleItemId === null) singleItemId = selId;
          else if (singleItemId !== selId) unique = false;
          continue;
        }
        if (isBlockAmt(sel)) {
          const selId = String(sel.itemId);
          addAmt(selId, pickAmountCents(sel));
          foundAnyPerLineAmount = true;
          if (singleItemId === null) singleItemId = selId;
          else if (singleItemId !== selId) unique = false;
          continue;
        }
        if (isLegacyQty(sel)) {
          const selId = String(sel.itemId);
          addQty(selId, sel.quantity);
          if (singleItemId === null) singleItemId = selId;
          else if (singleItemId !== selId) unique = false;
          continue;
        }
        if (isLegacyAmt(sel)) {
          const selId = String(sel.itemId);
          addAmt(selId, pickAmountCents(sel));
          foundAnyPerLineAmount = true;
          if (singleItemId === null) singleItemId = selId;
          else if (singleItemId !== selId) unique = false;
          continue;
        }
      }

      // Fallback: attribute doc.amount to the single item
      if (
        !foundAnyPerLineAmount &&
        unique &&
        singleItemId &&
        typeof doc.amount === 'number' &&
        doc.amount > 0
      ) {
        addAmt(singleItemId, Math.trunc(doc.amount));
      }
    }

    // ---- Compute remaining qty by item (server truth)
    const byItemId: Record<string, number> = {};
    const lineTotalByItemId = new Map<string, number>();

    for (const item of order.items ?? []) {
      // 👇 normalize item id from either id or _id
      const idRaw = (item as any)?.id ?? (item as any)?._id;
      const id = idRaw == null ? '' : String(idRaw);
      if (!id) continue;

      const purchased = Number.isFinite(item.quantity)
        ? Math.trunc(item.quantity as number)
        : 1;
      const alreadyQty = refundedQtyByItemId.get(id) ?? 0;
      byItemId[id] = Math.max(0, purchased - alreadyQty);

      const lineTotal =
        typeof item.amountTotal === 'number'
          ? item.amountTotal
          : (item.unitAmount ?? 0) * (item.quantity ?? 1);
      lineTotalByItemId.set(id, Math.trunc(lineTotal));
    }

    // ---- Decide which items are fully refunded
    const fullyRefundedItemIds: string[] = [];
    for (const item of order.items ?? []) {
      const idRaw = (item as any)?.id ?? (item as any)?._id;
      const id = idRaw == null ? '' : String(idRaw);
      if (!id) continue;

      const qtyRemaining = byItemId[id] ?? 0;
      const lineTotal = lineTotalByItemId.get(id) ?? 0;
      const refundedAmt = refundedAmountByItemId.get(id) ?? 0;

      const coveredByAmount = refundedAmt >= Math.max(0, lineTotal - 1);
      if (qtyRemaining === 0 || coveredByAmount) fullyRefundedItemIds.push(id);
    }

    // materialize maps
    const refundedQtyByItemIdObj: Record<string, number> = {};
    for (const [id, qty] of refundedQtyByItemId)
      refundedQtyByItemIdObj[id] = qty;

    const refundedAmountByItemIdObj: Record<string, number> = {};
    for (const [id, cents] of refundedAmountByItemId)
      refundedAmountByItemIdObj[id] = cents;

    return NextResponse.json({
      ok: true,
      byItemId, // remaining qty by item (server truth)
      remainingCents, // order-level remaining (for header)
      refundedQtyByItemId: refundedQtyByItemIdObj,
      refundedAmountByItemId: refundedAmountByItemIdObj,
      fullyRefundedItemIds // 👈 NEW: authoritative list for UI
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
