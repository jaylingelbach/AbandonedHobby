import { NextRequest, NextResponse } from 'next/server';
import { getPayload, PayloadRequest } from 'payload';
import config from '@/payload.config';

import type { OrderForRefunds, OrderItemCore } from '@/domain/orders/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // ---------- Domain types ----------
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

  type RefundDoc = {
    selections?: unknown[];
    amount?: number;
    status?: 'succeeded' | 'pending' | 'failed' | string;
    order?: string;
  };

  // ---------- Type guards / helpers ----------
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

  const pickAmountCents = (sel: SelBlockAmount): number =>
    isNum(sel.amountCents)
      ? Math.trunc(sel.amountCents)
      : isNum(sel.amount)
        ? Math.trunc(sel.amount)
        : 0;

  const getItemId = (
    item: OrderItemCore | { id?: string; _id?: string }
  ): string =>
    String(
      (item as { id?: string; _id?: string }).id ??
        (item as { _id?: string })._id ??
        ''
    );

  const safeInt = (n: unknown, fallback = 0): number =>
    typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : fallback;

  const toId = (v: unknown): string => (v == null ? '' : String(v));

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId') ?? '';
    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }
    const includePending = searchParams.get('includePending') === 'true';

    const payload = await getPayload({ config });
    // Payload wants its own request shape
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

    // ---- Load order (need item totals to decide full coverage by amount)
    const order = (await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true
    })) as OrderForRefunds | null;

    if (!order?.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Build set of valid order-line IDs
    const orderItemIds = new Set<string>(
      (order.items ?? [])
        .map(getItemId)
        .filter((s): s is string => s.length > 0)
    );

    // ---- Fetch refunds
    const counted: Array<'succeeded' | 'pending'> = includePending
      ? ['succeeded', 'pending']
      : ['succeeded'];

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

    // ---- Order-level remaining cents (for header)
    const refundedCentsFromDocs = refundDocs.reduce<number>(
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

    // ---- Aggregate per-line qty + amount (order-line ID validated)
    const refundedQtyByItemId = new Map<string, number>();
    const refundedAmountByItemId = new Map<string, number>();

    const addQty = (id: string, n: number) => {
      if (!orderItemIds.has(id) || n <= 0) return;
      refundedQtyByItemId.set(
        id,
        (refundedQtyByItemId.get(id) ?? 0) + Math.trunc(n)
      );
    };

    const addAmt = (id: string, cents: number) => {
      if (!orderItemIds.has(id) || cents <= 0) return;
      refundedAmountByItemId.set(
        id,
        (refundedAmountByItemId.get(id) ?? 0) + Math.trunc(cents)
      );
    };

    for (const doc of refundDocs) {
      const sels = Array.isArray(doc.selections) ? doc.selections : [];
      let foundAnyPerLineAmount = false;

      // Track if all (valid) selections point to a single line
      let singleItemId: string | null = null;
      let unique = true;

      for (const sel of sels) {
        if (isBlockQty(sel)) {
          const selId = toId(sel.itemId);
          if (orderItemIds.has(selId)) {
            addQty(selId, sel.quantity);
            singleItemId = singleItemId ?? selId;
            if (singleItemId !== selId) unique = false;
          } else {
            // Unknown itemId in selection; ignore but keep going
            // console.warn('[refunds][api] qty selection unknown itemId', { selId, known: [...orderItemIds] });
          }
          continue;
        }

        if (isBlockAmt(sel)) {
          const selId = toId(sel.itemId);
          const cents = pickAmountCents(sel);
          if (orderItemIds.has(selId)) {
            addAmt(selId, cents);
            foundAnyPerLineAmount = true;
            singleItemId = singleItemId ?? selId;
            if (singleItemId !== selId) unique = false;
          } else {
            // Unknown itemId in selection; ignore but keep going
            // console.warn('[refunds][api] amount selection unknown itemId', { selId, known: [...orderItemIds] });
          }
          continue;
        }

        // Ignore any other shapes (legacy removed)
      }

      // Fallbacks:
      // 1) If there were no per-line amounts and we can attribute to a
      //    single line (based on valid selections), push doc.amount there.
      if (
        !foundAnyPerLineAmount &&
        unique &&
        singleItemId &&
        typeof doc.amount === 'number' &&
        doc.amount > 0
      ) {
        addAmt(singleItemId, Math.trunc(doc.amount));
      }

      // 2) If the order literally has one line, attribute doc.amount there
      //    even if selection IDs were unknown.
      if (
        !foundAnyPerLineAmount &&
        orderItemIds.size === 1 &&
        typeof doc.amount === 'number' &&
        doc.amount > 0
      ) {
        const [onlyId] = Array.from(orderItemIds);
        if (typeof onlyId === 'string' && onlyId.length > 0) {
          addAmt(onlyId, Math.trunc(doc.amount));
        }
      }
    }

    // ---- Compute remaining qty by item (server truth)
    const byItemId: Record<string, number> = {};
    const lineTotalByItemId = new Map<string, number>();

    for (const item of order.items ?? []) {
      const id = getItemId(item);
      if (!id) continue;

      const purchased = safeInt(item.quantity, 1);
      const alreadyQty = refundedQtyByItemId.get(id) ?? 0;
      byItemId[id] = Math.max(0, purchased - alreadyQty);

      const lineTotalRaw =
        typeof item.amountTotal === 'number'
          ? item.amountTotal
          : safeInt(item.unitAmount, 0) * safeInt(item.quantity, 1);
      lineTotalByItemId.set(id, Math.trunc(lineTotalRaw));
    }

    // ---- Decide which items are fully refunded
    const fullyRefundedItemIds: string[] = [];
    for (const item of order.items ?? []) {
      const id = getItemId(item);
      if (!id) continue;

      const qtyRemaining = byItemId[id] ?? 0;
      const lineTotal = lineTotalByItemId.get(id) ?? 0;
      const refundedAmt = refundedAmountByItemId.get(id) ?? 0;

      const coveredByAmount = refundedAmt >= Math.max(0, lineTotal - 1);
      if (qtyRemaining === 0 || coveredByAmount) {
        fullyRefundedItemIds.push(id);
      }
    }

    // ---- Debug: one-line comparison of keys to spot mismatches fast
    // (Comment out in prod if too noisy)
    try {
      console.log('[refunds][api] items', {
        orderItemIds: Array.from(orderItemIds),
        mapQtyKeys: Array.from(refundedQtyByItemId.keys()),
        mapAmtKeys: Array.from(refundedAmountByItemId.keys())
      });
    } catch {
      /* noop */
    }

    // ---- Materialize maps for JSON
    const refundedQtyByItemIdObj: Record<string, number> = {};
    for (const [id, qty] of refundedQtyByItemId) {
      refundedQtyByItemIdObj[id] = qty;
    }

    const refundedAmountByItemIdObj: Record<string, number> = {};
    for (const [id, cents] of refundedAmountByItemId) {
      refundedAmountByItemIdObj[id] = cents;
    }

    return NextResponse.json({
      ok: true,
      byItemId, // remaining qty by item (server truth)
      remainingCents, // order-level remaining (for header)
      refundedQtyByItemId: refundedQtyByItemIdObj,
      refundedAmountByItemId: refundedAmountByItemIdObj,
      fullyRefundedItemIds // authoritative list for UI
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
