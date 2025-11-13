'use client';

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  KeyboardEvent
} from 'react';
import { useAuth, useDocumentInfo } from '@payloadcms/ui';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

import type { OrderLite } from './types';
import {
  buildClientIdempotencyKeyV2,
  clampInteger,
  cleanMoneyInput,
  parseMoneyToCents
} from './utils/ui/utils';

import {
  buildRefundLines,
  dollarsMapToCents,
  computeItemsSubtotalCents,
  computePreviewCents,
  getEffectiveRemainingCents,
  sumObjectValues,
  buildSelections
} from './utils/ui/refund-calc';

const DEBUG_REFUNDS = process.env.NODE_ENV === 'development';

function dbg(title: string, data?: unknown) {
  if (!DEBUG_REFUNDS) return;
  console.groupCollapsed(`[refunds][ui] ${title}`);
  if (data !== undefined) console.log(data);
  console.groupEnd();
}

function dbgTable(
  title: string,
  rows: Record<string, unknown> | Array<Record<string, unknown>>
) {
  if (!DEBUG_REFUNDS) return;
  console.groupCollapsed(`[refunds][ui] ${title}`);
  try {
    console.table(rows);
  } catch (error) {
    console.log(`rows:${rows}, error: ${error}`);
  }
  console.groupEnd();
}

export function RefundManager() {
  const { id: documentId, collectionSlug } = useDocumentInfo();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<OrderLite | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [formError, setFormError] = useState<string | null>(null);

  // SERVER TRUTH (all four maps below come from the endpoint)
  const [remainingQtyByItemId, setRemainingQtyByItemId] = useState<
    Record<string, number>
  >({});
  const [refundedQtyByItemId, setRefundedQtyByItemId] = useState<
    Record<string, number>
  >({});
  const [refundedAmountByItemId, setRefundedAmountByItemId] = useState<
    Record<string, number>
  >({});
  const [fullyRefundedByItemId, setFullyRefundedByItemId] = useState<
    Record<string, boolean>
  >({});
  const [remainingCentsFromServer, setRemainingCentsFromServer] = useState<
    number | null
  >(null);
  const [shippingInfo, setShippingInfo] = useState<{
    originalCents: number;
    refundedCents: number;
    remainingCents: number;
  } | null>(null);

  // LOCAL FORM
  const [quantitiesByItemId, setQuantitiesByItemId] = useState<
    Record<string, number>
  >({});
  const [partialAmountByItemId, setPartialAmountByItemId] = useState<
    Record<string, string>
  >({});
  const [reason, setReason] = useState<
    'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other'
  >('requested_by_customer');
  const [refundShippingDollars, setRefundShippingDollars] =
    useState<string>('');
  const [restockingFeeDollars, setRestockingFeeDollars] =
    useState<string>('0.00');

  const isOrdersCollection = collectionSlug === 'orders';
  const isStaff =
    Array.isArray(user?.roles) && user.roles.includes('super-admin');

  // Auto-populate shipping when shipping info is available
  useEffect(() => {
    if (
      shippingInfo &&
      shippingInfo.remainingCents > 0 &&
      !refundShippingDollars
    ) {
      const suggested = (shippingInfo.remainingCents / 100).toFixed(2);
      setRefundShippingDollars(suggested);
    }
  }, [shippingInfo, refundShippingDollars]);

  useEffect(() => {
    if (!DEBUG_REFUNDS) return;
    dbgTable('STATE remainingQtyByItemId', remainingQtyByItemId);
    dbgTable('STATE refundedQtyByItemId', refundedQtyByItemId);
    dbgTable('STATE refundedAmountByItemId', refundedAmountByItemId);
    dbgTable('STATE fullyRefundedByItemId', fullyRefundedByItemId);
    dbg('STATE remainingCentsFromServer', remainingCentsFromServer);
    dbg('STATE shippingInfo', shippingInfo);
  }, [
    remainingQtyByItemId,
    refundedQtyByItemId,
    refundedAmountByItemId,
    fullyRefundedByItemId,
    remainingCentsFromServer,
    shippingInfo
  ]);

  /** Stable: no external reactive values used except state setters */
  const fetchRemainingForOrder = useCallback(
    async (orderId: string): Promise<void> => {
      try {
        dbg('GET /api/admin/refunds/remaining → start');
        const res = await fetch(
          `/api/admin/refunds/remaining?orderId=${orderId}&includePending=true`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok) throw new Error('failed');

        const json: {
          ok?: boolean;
          byItemId?: Record<string, number>;
          remainingCents?: number;
          refundedAmountByItemId?: Record<string, number>;
          refundedQtyByItemId?: Record<string, number>;
          fullyRefundedItemIds?: string[];
          shipping?: {
            originalCents?: number;
            refundedCents?: number;
            remainingCents?: number;
          };
        } = await res.json();

        dbg('GET /api/admin/refunds/remaining → payload', {
          byItemIdKeys: Object.keys(json.byItemId ?? {}),
          remainingCents: json.remainingCents
        });

        if (!json?.ok) throw new Error('not ok');

        // 1) order-level remaining (for header)
        setRemainingCentsFromServer(
          typeof json.remainingCents === 'number' ? json.remainingCents : null
        );

        // 2) per-line maps (server truth)
        setRemainingQtyByItemId(json.byItemId ?? {});
        setRefundedQtyByItemId(json.refundedQtyByItemId ?? {});
        setRefundedAmountByItemId(json.refundedAmountByItemId ?? {});

        // 3) materialize array → boolean map for chip rendering
        const fullyMap = Array.isArray(json.fullyRefundedItemIds)
          ? Object.fromEntries(
              json.fullyRefundedItemIds.map((id) => [id, true])
            )
          : {};
        setFullyRefundedByItemId(fullyMap);

        // 4) shipping info
        if (json.shipping) {
          setShippingInfo({
            originalCents: json.shipping.originalCents ?? 0,
            refundedCents: json.shipping.refundedCents ?? 0,
            remainingCents: json.shipping.remainingCents ?? 0
          });
        } else {
          setShippingInfo(null);
        }
      } catch (error) {
        console.error('[refunds][ui] Failed to fetch remaining:', error);
        // Reset everything on error so UI doesn’t get stuck
        setRemainingCentsFromServer(null);
        setRemainingQtyByItemId({});
        setRefundedQtyByItemId({});
        setRefundedAmountByItemId({});
        setFullyRefundedByItemId({});
        setShippingInfo(null);
      }
    },
    []
  );

  /** Stable: depends only on fetchRemainingForOrder */
  const refreshAfterRefund = useCallback(
    async (orderId: string): Promise<void> => {
      dbg('refreshAfterRefund → begin', { orderId });

      const orderRes = await fetch(`/api/orders/${orderId}?depth=0`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (orderRes.ok) {
        const next: OrderLite = await orderRes.json();
        setOrder(next);
        dbg('refreshAfterRefund → order loaded', {
          total: next.total,
          refundedTotalCents: next.refundedTotalCents,
          status: next.status
        });
      } else {
        dbg('refreshAfterRefund → order load failed', {
          status: orderRes.status
        });
      }

      await fetchRemainingForOrder(orderId);
      dbg('refreshAfterRefund → done');
    },
    [fetchRemainingForOrder]
  );

  useEffect(() => {
    if (order?.id) {
      void fetchRemainingForOrder(order.id);
    }
  }, [order?.id, fetchRemainingForOrder]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!documentId || !isOrdersCollection) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/orders/${documentId}?depth=0`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('load failed');
        const data: OrderLite = await res.json();
        if (aborted) return;
        setOrder(data);
        dbg('initial order load', {
          total: data.total,
          refundedTotalCents: data.refundedTotalCents,
          status: data.status
        });
        setCurrency((data.currency ?? 'USD').toUpperCase());
      } catch {
        toast.error('Failed to load order for refunds.');
      } finally {
        if (!aborted) setIsLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [documentId, isOrdersCollection]);

  const effectiveRemainingRefundableCents = getEffectiveRemainingCents(
    order,
    remainingCentsFromServer
  );
  const refundLines = useMemo(() => buildRefundLines(order), [order]);

  // Derive fully-refunded per line from server truth we already have
  const derivedFullyRefundedByItemId = useMemo(() => {
    const out: Record<string, boolean> = {};

    for (const line of refundLines) {
      const itemId = line.itemId;

      const hasQtyKey = Object.hasOwn(remainingQtyByItemId, itemId);
      const hasAmtKey = Object.hasOwn(
        refundedAmountByItemId as Record<string, unknown>,
        itemId
      );
      const hasRefQtyKey = Object.hasOwn(
        refundedQtyByItemId as Record<string, unknown>,
        itemId
      );

      const remainingQty = hasQtyKey ? remainingQtyByItemId[itemId] : null;
      const refundedAmtCents = hasAmtKey
        ? refundedAmountByItemId[itemId]
        : null;
      const refundedQty = hasRefQtyKey ? refundedQtyByItemId[itemId] : null;

      const lineTotalCents =
        typeof line.amountTotal === 'number'
          ? line.amountTotal
          : line.unitAmount * line.quantityPurchased;

      const qtyFully = hasQtyKey ? remainingQty === 0 : false;
      const amountCovers = hasAmtKey
        ? (refundedAmtCents as number) >= Math.max(0, lineTotalCents - 1)
        : false;
      const refQtyCovers = hasRefQtyKey
        ? (refundedQty as number) >= Math.max(1, line.quantityPurchased)
        : false;

      if (
        (hasQtyKey || hasAmtKey || hasRefQtyKey) &&
        (qtyFully || amountCovers || refQtyCovers)
      ) {
        out[itemId] = true;
      }

      if (DEBUG_REFUNDS) {
        console.log('[refunds][ui] compare', {
          itemId,
          remainingQty: hasQtyKey ? remainingQty : undefined,
          refundedAmtCents: hasAmtKey ? refundedAmtCents : undefined,
          refundedQty: hasRefQtyKey ? refundedQty : undefined,
          lineTotalCents,
          qtyFully,
          amountCovers,
          refQtyCovers
        });
        if (!hasQtyKey && !hasAmtKey && !hasRefQtyKey) {
          console.warn('[refunds][ui] id not found in server maps', {
            itemId,
            remainingQtyKeys: Object.keys(remainingQtyByItemId),
            refundedAmountKeys: Object.keys(refundedAmountByItemId)
          });
        }
      }
    }

    return out;
  }, [
    refundLines,
    remainingQtyByItemId,
    refundedAmountByItemId,
    refundedQtyByItemId
  ]);

  // Merge: either server explicitly flags the item, or our derivation does
  const mergedFullyRefundedByItemId = useMemo(() => {
    const out: Record<string, boolean> = { ...derivedFullyRefundedByItemId };
    for (const [id, value] of Object.entries(fullyRefundedByItemId)) {
      if (value) out[id] = true;
    }
    return out;
  }, [derivedFullyRefundedByItemId, fullyRefundedByItemId]);

  // dollars → cents maps
  const partialAmountCentsByItemId = useMemo(
    () => dollarsMapToCents(partialAmountByItemId),
    [partialAmountByItemId]
  );
  const partialAmountsTotalCents = useMemo(
    () => sumObjectValues(partialAmountCentsByItemId),
    [partialAmountCentsByItemId]
  );

  const itemsSubtotalCents = useMemo(
    () =>
      computeItemsSubtotalCents({
        refundLines,
        quantitiesByItemId,
        // NOTE: we use server truth here.
        remainingQtyByItemId,
        partialAmountCentsByItemId,
        clamp: clampInteger
      }),
    [
      refundLines,
      quantitiesByItemId,
      remainingQtyByItemId,
      partialAmountCentsByItemId
    ]
  );

  const refundShippingCentsValue = useMemo(
    () => parseMoneyToCents(refundShippingDollars),
    [refundShippingDollars]
  );
  const restockingFeeCentsValue = useMemo(
    () => parseMoneyToCents(restockingFeeDollars),
    [restockingFeeDollars]
  );

  const previewCents = useMemo(
    () =>
      computePreviewCents(
        itemsSubtotalCents,
        partialAmountsTotalCents,
        parseMoneyToCents(refundShippingDollars),
        parseMoneyToCents(restockingFeeDollars)
      ),
    [
      itemsSubtotalCents,
      partialAmountsTotalCents,
      refundShippingDollars,
      restockingFeeDollars
    ]
  );

  const isFullyRefunded =
    effectiveRemainingRefundableCents <= 0 && (order?.total ?? 0) > 0;

  // Over-limit guard (items + shipping)
  useEffect(() => {
    if (!order) return;
    if (previewCents > effectiveRemainingRefundableCents) {
      setFormError(
        `Selection exceeds remaining refundable amount by ${formatCurrency(
          (previewCents - effectiveRemainingRefundableCents) / 100,
          currency
        )}.`
      );
    } else {
      // Also check shipping limit
      const requestedShippingCents = parseMoneyToCents(refundShippingDollars);
      if (
        shippingInfo &&
        requestedShippingCents > shippingInfo.remainingCents
      ) {
        setFormError(
          `Shipping refund exceeds remaining refundable shipping by ${formatCurrency(
            (requestedShippingCents - shippingInfo.remainingCents) / 100,
            currency
          )}.`
        );
      } else {
        setFormError(null);
      }
    }
  }, [
    order,
    previewCents,
    effectiveRemainingRefundableCents,
    currency,
    refundShippingDollars,
    shippingInfo
  ]);

  function setQuantityFor(itemId: string, next: number, maxQty: number): void {
    setQuantitiesByItemId((prev) => ({
      ...prev,
      [itemId]: clampInteger(next, 0, maxQty)
    }));
  }

  function handleQtyKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    itemId: string,
    maxQty: number
  ): void {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = clampInteger(
        Number((e.currentTarget as HTMLInputElement).value) || 0,
        0,
        maxQty
      );
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      setQuantityFor(itemId, current + delta, maxQty);
    }
  }

  type InternalSelection = {
    itemId: string;
    amountCents?: number;
    quantity?: number;
  };
  const hasAmount = (
    selection: InternalSelection
  ): selection is { itemId: string; amountCents: number } =>
    typeof selection.amountCents === 'number' &&
    Number.isFinite(selection.amountCents) &&
    selection.amountCents > 0;
  const hasQuantity = (
    selection: InternalSelection
  ): selection is { itemId: string; quantity: number } =>
    typeof selection.quantity === 'number' &&
    Number.isFinite(selection.quantity) &&
    Math.trunc(selection.quantity) > 0;

  type ApiSelection =
    | { type: 'amount'; itemId: string; amountCents: number }
    | { type: 'quantity'; itemId: string; quantity: number };

  async function submitRefund(): Promise<void> {
    if (!order) return;

    const selections = buildSelections({
      refundLines,
      quantitiesByItemId,
      // CRITICAL: server remaining drives quantity clamping
      remainingQtyByItemId,
      partialAmountCentsByItemId,
      clamp: clampInteger
    });

    const shippingCents = parseMoneyToCents(refundShippingDollars);
    const restockingCents = parseMoneyToCents(restockingFeeDollars);

    // Allow either line selections OR shipping-only (positive shippingCents)
    if (selections.length === 0 && shippingCents <= 0) {
      toast.error(
        'Enter a partial amount, select at least one quantity, or provide a positive shipping refund.'
      );
      return;
    }

    const apiSelections = selections.reduce<ApiSelection[]>(
      (acc, selection) => {
        if (hasAmount(selection)) {
          acc.push({
            type: 'amount',
            itemId: selection.itemId,
            amountCents: Math.trunc(selection.amountCents)
          });
        } else if (hasQuantity(selection)) {
          acc.push({
            type: 'quantity',
            itemId: selection.itemId,
            quantity: Math.trunc(selection.quantity)
          });
        }
        return acc;
      },
      []
    );
    // Note: apiSelections may be empty for shipping-only refunds

    let idempotencyKey: string | undefined;
    try {
      idempotencyKey = await buildClientIdempotencyKeyV2({
        orderId: order.id,
        selections,
        options: {
          reason,
          restockingFeeCents: restockingCents,
          refundShippingCents: shippingCents
        }
      });
    } catch {
      // swallow – idempotencyKey stays undefined
    }

    const body = {
      orderId: order.id,
      reason,
      selections: apiSelections,
      idempotencyKey,
      refundShippingCents: shippingCents > 0 ? shippingCents : undefined,
      restockingFeeCents: restockingCents > 0 ? restockingCents : undefined
    };

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg =
          json?.error ||
          json?.message ||
          (json?.details
            ? JSON.stringify(json.details, null, 2)
            : `HTTP ${res.status}`);
        toast.error(`Refund failed: ${msg}`);
        return;
      }

      toast.success(
        `Refund ${json.status}: ${formatCurrency((json.amount ?? 0) / 100, currency)}`
      );

      await refreshAfterRefund(order.id);
      setQuantitiesByItemId({});
      setPartialAmountByItemId({});
      setRefundShippingDollars('');
      setRestockingFeeDollars('0.00');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund failed.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOrdersCollection) return null;

  if (!isStaff) {
    return (
      <div className="ah-card ah-refund-card">
        <div className="ah-card-header">
          <h3 className="ah-card-title">Refunds</h3>
        </div>
        <div className="ah-card-body">
          <p className="text-sm text-muted-foreground">
            Refunds available to staff only.
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="ah-card ah-refund-card">
        <div className="ah-card-header">
          <h3 className="ah-card-title">Refunds</h3>
        </div>
        <div className="ah-card-body">
          <div className="ah-skel ah-skel-text" />
          <div className="ah-skel ah-skel-btn" style={{ marginTop: 8 }} />
        </div>
      </div>
    );
  }

  const serverTruthReadyFor = (id: string) =>
    Object.hasOwn(remainingQtyByItemId as Record<string, unknown>, id) ||
    Object.hasOwn(refundedAmountByItemId as Record<string, unknown>, id) ||
    Object.hasOwn(fullyRefundedByItemId as Record<string, unknown>, id);

  return (
    <div className="ah-card ah-refund-card">
      <div className="ah-card-header">
        <div className="ah-refund-header">
          <div className="ah-refund-header-left">
            <h3 className="ah-card-title">Refunds</h3>
            <p className="ah-subtitle">
              Refunded{' '}
              <strong>
                {formatCurrency(
                  ((order.total ?? 0) -
                    (typeof remainingCentsFromServer === 'number'
                      ? remainingCentsFromServer
                      : Math.max(
                          0,
                          (order.total ?? 0) - (order.refundedTotalCents ?? 0)
                        ))) /
                    100,
                  currency
                )}
              </strong>{' '}
              of {formatCurrency((order.total ?? 0) / 100, currency)}
            </p>
          </div>

          <span
            className={`ah-chip ${isFullyRefunded ? 'ah-chip--success' : 'ah-chip--info'}`}
          >
            {isFullyRefunded
              ? 'Fully refunded'
              : `Remaining ${formatCurrency(
                  (typeof remainingCentsFromServer === 'number'
                    ? remainingCentsFromServer
                    : Math.max(
                        0,
                        order.total - (order.refundedTotalCents ?? 0)
                      )) / 100,
                  currency
                )}`}
          </span>
        </div>
      </div>

      <div className="ah-card-body">
        <div className="ah-refund-table">
          <div className="ah-refund-head">
            <div className="ah-refund-col ah-refund-col--name ah-refund-head-cell">
              Item
            </div>
            <div className="ah-refund-col ah-refund-col--qty ah-refund-head-cell text-right">
              Qty Purchased
            </div>
            <div className="ah-refund-col ah-refund-col--qty ah-refund-head-cell text-right">
              Return QTY
            </div>
            <div className="ah-refund-col ah-refund-col--amount ah-refund-head-cell text-right">
              Partial Refund Amount
            </div>
            <div className="ah-refund-col ah-refund-col--unit ah-refund-head-cell text-right">
              Unit Price
            </div>
          </div>

          <div className="ah-refund-body">
            {refundLines.map((line) => {
              const itemId = line.itemId;
              const readyForLine = serverTruthReadyFor(itemId);

              const hasQtyKey = Object.hasOwn(
                remainingQtyByItemId as Record<string, unknown>,
                itemId
              );
              const hasAmtKey = Object.hasOwn(
                refundedAmountByItemId as Record<string, unknown>,
                itemId
              );

              const remainingQty = hasQtyKey
                ? (remainingQtyByItemId[itemId] as number)
                : null;
              const refundedAmtCents = hasAmtKey
                ? (refundedAmountByItemId[itemId] as number)
                : null;

              const lineTotalCents =
                typeof line.amountTotal === 'number'
                  ? line.amountTotal
                  : line.unitAmount * line.quantityPurchased;

              const fromMerged = !!mergedFullyRefundedByItemId[itemId];
              const qtyFully = hasQtyKey
                ? (remainingQty as number) === 0
                : false;
              const amountCovers = hasAmtKey
                ? (refundedAmtCents as number) >=
                  Math.max(0, lineTotalCents - 1)
                : false;

              const isLineFullyRefunded =
                fromMerged ||
                ((hasQtyKey || hasAmtKey) && (qtyFully || amountCovers));

              // Input clamping: if we do not have remainingQty yet, allow up to purchased qty
              const maxQty = hasQtyKey
                ? (remainingQty as number)
                : line.quantityPurchased;
              const selectedQty = clampInteger(
                quantitiesByItemId[itemId] ?? 0,
                0,
                maxQty
              );

              if (DEBUG_REFUNDS && readyForLine) {
                console.groupCollapsed(
                  `[refunds][ui] line ${itemId} — chip? ${isLineFullyRefunded ? 'YES' : 'no'}`
                );
                console.log({
                  name: line.name,
                  remainingQtyFromServer: hasQtyKey
                    ? remainingQty
                    : '(unknown)',
                  refundedAmtCents: hasAmtKey ? refundedAmtCents : '(unknown)',
                  lineTotalCents,
                  qtyFully,
                  amountCovers
                });
                console.groupEnd();
              }

              return (
                <div
                  key={itemId}
                  className="ah-refund-row"
                  data-item-id={itemId}
                >
                  <div className="ah-refund-col ah-refund-col--name">
                    <div className="ah-item-title">
                      {line.name}
                      {!readyForLine && (
                        <span
                          className="ah-chip ah-chip--muted"
                          style={{ marginLeft: 8 }}
                        >
                          loading…
                        </span>
                      )}
                      {serverTruthReadyFor(itemId) && isLineFullyRefunded && (
                        <span
                          className="ah-chip ah-chip--muted"
                          style={{ marginLeft: 8 }}
                        >
                          {qtyFully
                            ? 'Refunded'
                            : `Refunded ${formatCurrency(
                                Math.min(
                                  typeof refundedAmtCents === 'number'
                                    ? refundedAmtCents
                                    : 0,
                                  lineTotalCents
                                ) / 100,
                                currency
                              )}`}
                        </span>
                      )}
                    </div>

                    {!isLineFullyRefunded &&
                      hasAmtKey &&
                      (refundedAmtCents ?? 0) > 0 && (
                        <div className="ah-item-meta">
                          Refunded so far:{' '}
                          {formatCurrency(
                            (refundedAmtCents as number) / 100,
                            currency
                          )}
                        </div>
                      )}

                    <div className="ah-item-meta">
                      Cost{' '}
                      {formatCurrency(
                        (line.amountTotal ?? line.unitAmount) / 100,
                        currency
                      )}
                    </div>
                  </div>

                  <div className="ah-refund-col ah-refund-col--qty text-right">
                    {line.quantityPurchased}
                  </div>

                  <div className="ah-refund-col ah-refund-col--qty">
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="ah-chip-input"
                      min={0}
                      max={maxQty}
                      value={selectedQty}
                      disabled={
                        !readyForLine || isLineFullyRefunded || isLoading
                      }
                      onKeyDown={(event) =>
                        handleQtyKeyDown(event, itemId, maxQty)
                      }
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        setQuantityFor(itemId, parsed, maxQty);
                      }}
                      onBlur={(event) => {
                        const parsed = Number(event.target.value);
                        const clamped = clampInteger(parsed, 0, maxQty);
                        if (clamped !== parsed) {
                          setQuantityFor(itemId, clamped, maxQty);
                        }
                      }}
                    />
                    {hasQtyKey &&
                      remainingQty! < line.quantityPurchased &&
                      !isLineFullyRefunded && (
                        <div className="ah-mini-hint">
                          Remaining: {remainingQty}
                        </div>
                      )}
                  </div>

                  <div className="ah-refund-col ah-refund-col--amount">
                    <label className="ah-field" style={{ marginTop: 0 }}>
                      <div className="ah-money">
                        <span aria-hidden className="ah-money-prefix">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="ah-input ah-money-input"
                          placeholder="0.00"
                          value={partialAmountByItemId[itemId] ?? ''}
                          disabled={
                            !readyForLine || isLineFullyRefunded || isLoading
                          }
                          onChange={(event) =>
                            setPartialAmountByItemId((prev) => ({
                              ...prev,
                              [itemId]: cleanMoneyInput(event.target.value)
                            }))
                          }
                        />
                      </div>
                      {(partialAmountCentsByItemId[itemId] ?? 0) > 0 && (
                        <div className="ah-mini-hint">Overrides quantity</div>
                      )}
                    </label>
                  </div>

                  <div className="ah-refund-col ah-refund-col--unit text-right">
                    {formatCurrency(line.unitAmount / 100, currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ah-grid ah-grid-3 ah-refund-grid mt-3">
          <label className="ah-field">
            <span className="ah-mini-label">Reason</span>
            <select
              className="ah-input"
              value={reason}
              onChange={(event) =>
                setReason(
                  event.target.value as
                    | 'requested_by_customer'
                    | 'duplicate'
                    | 'fraudulent'
                    | 'other'
                )
              }
            >
              <option value="requested_by_customer">
                Requested by customer
              </option>
              <option value="duplicate">Duplicate</option>
              <option value="fraudulent">Fraudulent</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="ah-field">
            <span className="ah-mini-label">Refund shipping</span>
            <div className="ah-money">
              <span aria-hidden className="ah-money-prefix">
                $
              </span>
              <input
                type="text"
                className="ah-input ah-money-input"
                inputMode="decimal"
                placeholder="0.00"
                value={refundShippingDollars}
                onChange={(event) =>
                  setRefundShippingDollars(cleanMoneyInput(event.target.value))
                }
              />
            </div>
            {shippingInfo && shippingInfo.originalCents > 0 && (
              <div className="ah-mini-hint" style={{ marginTop: 4 }}>
                Original:{' '}
                {formatCurrency(shippingInfo.originalCents / 100, currency)}
                {shippingInfo.refundedCents > 0 && (
                  <>
                    {' '}
                    • Refunded:{' '}
                    {formatCurrency(shippingInfo.refundedCents / 100, currency)}
                  </>
                )}
                {shippingInfo.remainingCents > 0 && (
                  <>
                    {' '}
                    • Remaining:{' '}
                    {formatCurrency(
                      shippingInfo.remainingCents / 100,
                      currency
                    )}
                  </>
                )}
              </div>
            )}
          </label>

          <label className="ah-field">
            <span className="ah-mini-label">Restocking fee</span>
            <div className="ah-money">
              <span aria-hidden className="ah-money-prefix">
                $
              </span>
              <input
                type="text"
                className="ah-input ah-money-input"
                inputMode="decimal"
                placeholder="0.00"
                value={restockingFeeDollars}
                onChange={(event) =>
                  setRestockingFeeDollars(cleanMoneyInput(event.target.value))
                }
              />
            </div>
          </label>
        </div>

        <Separator className="my-3" />

        <div className="ah-refund-summary">
          <div className="ah-refund-summary-left">
            <div className="ah-summary-row">
              <span className="ah-summary-label">Items subtotal: </span>
              <span className="ah-summary-value">
                {formatCurrency(itemsSubtotalCents / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-row">
              <span className="ah-summary-label">
                + Refund amounts (custom):
              </span>
              <span className="ah-summary-value">
                {formatCurrency(partialAmountsTotalCents / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-row">
              <span className="ah-summary-label">+ Refund shipping: </span>
              <span className="ah-summary-value">
                {formatCurrency(refundShippingCentsValue / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-row">
              <span className="ah-summary-label">− Restocking fee: </span>
              <span className="ah-summary-value">
                {formatCurrency(restockingFeeCentsValue / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-divider" />
            <div className="ah-summary-row ah-summary-total">
              <span className="ah-summary-label">Amount to be refunded: </span>
              <span className="ah-summary-value">
                {formatCurrency(previewCents / 100, currency)}
              </span>
            </div>
            {formError && (
              <div className="ah-error" style={{ marginTop: 8 }}>
                {formError}
              </div>
            )}
          </div>

          <Button
            onClick={submitRefund}
            disabled={isLoading || isFullyRefunded}
            className="ah-refund-cta"
          >
            {isFullyRefunded
              ? 'Already refunded'
              : isLoading
                ? 'Submitting…'
                : 'Create refund'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RefundManager;
