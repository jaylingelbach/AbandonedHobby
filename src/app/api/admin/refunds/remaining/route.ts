import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';

export const runtime = 'nodejs';

const DEBUG_REMAINING = process.env.NODE_ENV === 'development';
const dbg = (title: string, data?: unknown) => {
  if (!DEBUG_REMAINING) return;
  console.log(`[refunds][server] ${title}`, data ?? '');
};

export async function GET(req: NextRequest) {
  // ---------- Canonical types ----------
  type SelQty = {
    blockType?: 'quantity';
    type?: 'quantity';
    itemId: string;
    quantity: number;
  };
  type SelAmt = {
    blockType?: 'amount';
    type?: 'amount';
    itemId: string;
    amountCents?: number;
    amount?: number;
  };
  type RefundDoc = {
    selections?: unknown[];
    amount?: number; // cents
    status?: string;
    order?: string;
  };
  type OrderItem = {
    id?: string;
    _id?: string;
    quantity?: number;
    unitAmount?: number; // cents
    amountTotal?: number; // cents
  };
  type OrderDoc = {
    id: string;
    total?: number; // cents
    refundedTotalCents?: number; // cents
    items?: OrderItem[];
  };

  // ---------- helpers ----------
  const isObj = (x: unknown): x is Record<string, unknown> =>
    typeof x === 'object' && x !== null;
  const isStr = (x: unknown): x is string => typeof x === 'string';
  const isNum = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x);

  const kindOf = (sel: unknown): 'quantity' | 'amount' | null => {
    if (!isObj(sel)) return null;
    const a = (sel['blockType'] ?? sel['type']) as unknown;
    return a === 'quantity' || a === 'amount' ? a : null;
  };

  const isQty = (sel: unknown): sel is SelQty =>
    isObj(sel) &&
    isStr(sel['itemId']) &&
    isNum(sel['quantity']) &&
    kindOf(sel) === 'quantity';

  const isAmt = (sel: unknown): sel is SelAmt =>
    isObj(sel) &&
    isStr(sel['itemId']) &&
    (isNum(sel['amountCents']) || isNum(sel['amount'])) &&
    kindOf(sel) === 'amount';

  const pickAmountCents = (sel: SelAmt): number =>
    isNum(sel.amountCents)
      ? Math.trunc(sel.amountCents)
      : isNum(sel.amount)
        ? Math.trunc(sel.amount)
        : 0;

  const getItemId = (item: OrderItem): string =>
    (item.id ?? item._id ?? '').toString();

  const safeInt = (n: unknown, fb = 0): number =>
    typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : fb;

  const approxEq = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

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
    if (!isStaff)
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    // ---- Load order
    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true
    })) as OrderDoc | null;
    if (!order?.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ---- Refund docs
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
    const refundDocs: RefundDoc[] = Array.isArray(docs)
      ? (docs as RefundDoc[])
      : [];

    // ---- Order-level remaining
    const refundedCentsFromDocs = refundDocs.reduce(
      (sum, r) =>
        sum + (typeof r.amount === 'number' ? Math.trunc(r.amount) : 0),
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

    // ---- Aggregation
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

    // Precompute line totals for heuristics
    const lineTotalByItemId = new Map<string, number>();
    const unitAmountByItemId = new Map<string, number>();
    const purchasedQtyByItemId = new Map<string, number>();
    for (const item of order.items ?? []) {
      const id = getItemId(item);
      if (!id) continue;
      const qty = safeInt(item.quantity, 1);
      purchasedQtyByItemId.set(id, qty);
      const unit = safeInt(item.unitAmount, 0);
      const total = isNum(item.amountTotal)
        ? Math.trunc(item.amountTotal!)
        : unit * qty;
      lineTotalByItemId.set(id, total);
      unitAmountByItemId.set(id, unit);
    }

    for (const doc of refundDocs) {
      const sels = Array.isArray(doc.selections) ? doc.selections : [];
      let foundPerLineAmount = false;
      let singleItemId: string | null = null;
      let unique = true;

      // Normal path: read explicit selections
      for (const sel of sels) {
        const k = kindOf(sel);
        if (k === 'quantity' && isQty(sel)) {
          const selId = String(sel.itemId);
          addQty(selId, sel.quantity);
          singleItemId = singleItemId ?? selId;
          if (singleItemId !== selId) unique = false;
          continue;
        }
        if (k === 'amount' && isAmt(sel)) {
          const selId = String(sel.itemId);
          addAmt(selId, pickAmountCents(sel));
          foundPerLineAmount = true;
          singleItemId = singleItemId ?? selId;
          if (singleItemId !== selId) unique = false;
          continue;
        }
      }

      // Fallback A: if selections pointed to a single item but had no amount,
      // attribute order-level doc.amount to that one item.
      if (
        !foundPerLineAmount &&
        unique &&
        singleItemId &&
        isNum(doc.amount) &&
        doc.amount > 0
      ) {
        addAmt(singleItemId, Math.trunc(doc.amount));
        continue;
      }

      // Fallback B (your case): selections are empty; try to match the doc.amount
      // to exactly one line by amountTotal OR unitAmount (±1¢ tolerance). Only if unique.
      if (
        !foundPerLineAmount &&
        (!sels || sels.length === 0) &&
        isNum(doc.amount) &&
        doc.amount > 0
      ) {
        const amt = Math.trunc(doc.amount);
        const candidates: string[] = [];
        for (const [id, total] of lineTotalByItemId) {
          if (approxEq(total, amt)) candidates.push(id);
        }
        if (candidates.length === 0) {
          for (const [id, unit] of unitAmountByItemId) {
            if (approxEq(unit, amt)) candidates.push(id);
          }
        }
        if (candidates.length === 1) {
          addAmt(candidates[0], amt);
        } else {
          dbg('fallback:B no unique match for order-level amount', {
            docAmount: amt,
            candidates
          });
        }
      }
    }

    // ---- Remaining qty by item
    const remainingQtyByItemId: Record<string, number> = {};
    for (const item of order.items ?? []) {
      const id = getItemId(item);
      if (!id) continue;
      const purchased = purchasedQtyByItemId.get(id) ?? 0;
      const alreadyQty = refundedQtyByItemId.get(id) ?? 0;
      remainingQtyByItemId[id] = Math.max(0, purchased - alreadyQty);
    }

    // ---- Fully-refunded items (qty OR amount)
    const fullyRefundedItemIds: string[] = [];
    for (const item of order.items ?? []) {
      const id = getItemId(item);
      if (!id) continue;
      const qtyRemaining = remainingQtyByItemId[id] ?? 0;
      const purchased = purchasedQtyByItemId.get(id) ?? 0;
      const lineTotal = lineTotalByItemId.get(id) ?? 0;
      const refundedAmt = refundedAmountByItemId.get(id) ?? 0;
      const coveredByQty = purchased > 0 && qtyRemaining === 0;
      const coveredByAmount = refundedAmt >= Math.max(0, lineTotal - 1); // 1¢ slop
      if (coveredByQty || coveredByAmount) fullyRefundedItemIds.push(id);
    }

    const refundedQtyByItemIdObj = Object.fromEntries(
      refundedQtyByItemId.entries()
    );
    const refundedAmountByItemIdObj = Object.fromEntries(
      refundedAmountByItemId.entries()
    );

    return NextResponse.json({
      ok: true,
      byItemId: remainingQtyByItemId,
      remainingCents,
      refundedQtyByItemId: refundedQtyByItemIdObj,
      refundedAmountByItemId: refundedAmountByItemIdObj,
      fullyRefundedItemIds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dbg('error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
