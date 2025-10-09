'use client';

import { useEffect, useMemo, useState, KeyboardEvent } from 'react';
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

/**
 * Staff-facing refund management UI for a single order.
 * - Per-line quantity refunds OR per-line partial amount refunds
 * - Optional refund shipping / restocking fee
 * - Live preview and server-validated submission
 */
export function RefundManager() {
  const { id: documentId, collectionSlug } = useDocumentInfo();
  const { user } = useAuth();

  // ----- Local state -----
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<OrderLite | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [formError, setFormError] = useState<string | null>(null);

  // Server-truth remaining quantities by item
  const [remainingQtyByItemId, setRemainingQtyByItemId] = useState<
    Record<string, number>
  >({});

  // Server-truth remaining refundable cents for the whole order
  const [remainingCentsFromServer, setRemainingCentsFromServer] = useState<
    number | null
  >(null);

  // Refund form state
  const [quantitiesByItemId, setQuantitiesByItemId] = useState<
    Record<string, number>
  >({});
  const [partialAmountByItemId, setPartialAmountByItemId] = useState<
    Record<string, string>
  >({}); // dollars.cents per line
  const [reason, setReason] = useState<
    'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other'
  >('requested_by_customer');

  const [refundedAmountByItemId, setRefundedAmountByItemId] = useState<
    Record<string, number>
  >({});

  const [refundedQtyByItemId, setRefundedQtyByItemId] = useState<
    Record<string, number>
  >({});

  // Dollars.cents fields → converted later
  const [refundShippingDollars, setRefundShippingDollars] =
    useState<string>('0.00');
  const [restockingFeeDollars, setRestockingFeeDollars] =
    useState<string>('0.00');

  // Guards
  const isOrdersCollection = collectionSlug === 'orders';
  const isStaff =
    Array.isArray(user?.roles) && user.roles.includes('super-admin');

  // ----- Helpers -----
  async function fetchRemainingForOrder(orderId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/admin/refunds/remaining?orderId=${orderId}&includePending=true`,
        { credentials: 'include', cache: 'no-store' }
      );
      if (!response.ok) {
        setRemainingQtyByItemId({});
        setRemainingCentsFromServer(null);
        return;
      }
      const json = (await response.json()) as {
        ok?: boolean;
        byItemId?: Record<string, number>;
        remainingCents?: number;
        refundedAmountByItemId?: Record<string, number>;
        refundedQtyByItemId?: Record<string, number>;
      };
      if (!json?.ok) {
        setRemainingQtyByItemId({});
        setRemainingCentsFromServer(null);
        setRefundedAmountByItemId({});
        setRefundedQtyByItemId({});
        return;
      }
      setRemainingQtyByItemId(json.byItemId ?? {});
      setRemainingCentsFromServer(
        typeof json.remainingCents === 'number' ? json.remainingCents : null
      );
      setRefundedAmountByItemId(json.refundedAmountByItemId ?? {});
      setRefundedQtyByItemId(json.refundedQtyByItemId ?? {});
    } catch {
      setRemainingQtyByItemId({});
      setRefundedQtyByItemId({});
      setRefundedAmountByItemId({});
      setRemainingCentsFromServer(null);
    }
  }

  async function refreshAfterRefund(orderId: string): Promise<void> {
    // 1) refresh order totals
    const orderResponse = await fetch(`/api/orders/${orderId}?depth=0`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (orderResponse.ok) {
      const updatedOrder: OrderLite = await orderResponse.json();
      setOrder(updatedOrder);
    }
    // 2) refresh remaining (order-level cents + per-item remaining qty)
    await fetchRemainingForOrder(orderId);
  }

  // ----- Effects -----
  useEffect(() => {
    if (!documentId || !isOrdersCollection) return;
    void fetchRemainingForOrder(String(documentId));
  }, [documentId, isOrdersCollection]);

  useEffect(() => {
    let isAborted = false;
    async function load() {
      if (!documentId || !isOrdersCollection) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/orders/${documentId}?depth=0`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to load order');
        const data: OrderLite = await response.json();
        if (isAborted) return;
        setOrder(data);
        setCurrency((data.currency ?? 'USD').toUpperCase());
      } catch {
        toast.error('Failed to load order for refunds.');
      } finally {
        if (!isAborted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isAborted = true;
    };
  }, [documentId, isOrdersCollection]);

  // ----- Derived values -----
  const effectiveRemainingRefundableCents = getEffectiveRemainingCents(
    order,
    remainingCentsFromServer
  );

  const refundLines = useMemo(() => buildRefundLines(order), [order]);

  // Parse per-line partial amounts -> cents; ignore invalid/empty
  const partialAmountCentsByItemId = useMemo(
    () => dollarsMapToCents(partialAmountByItemId),
    [partialAmountByItemId]
  );

  const partialAmountsTotalCents = useMemo(
    () => sumObjectValues(partialAmountCentsByItemId),
    [partialAmountCentsByItemId]
  );

  // Only prorate by quantity for lines WITHOUT an explicit amount
  const itemsSubtotalCents = useMemo(
    () =>
      computeItemsSubtotalCents({
        refundLines,
        quantitiesByItemId,
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

  // Convert staff-entered dollars → cents for math and preview
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

  // Over-limit guard
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
      setFormError(null);
    }
  }, [order, previewCents, effectiveRemainingRefundableCents, currency]);

  // ----- Handlers -----
  function setQuantityFor(itemId: string, next: number, maxQty: number): void {
    setQuantitiesByItemId((previous) => ({
      ...previous,
      [itemId]: clampInteger(next, 0, maxQty)
    }));
  }

  function handleQtyKeyDown(
    keyboardEvent: KeyboardEvent<HTMLInputElement>,
    itemId: string,
    maxQty: number
  ): void {
    if (keyboardEvent.key === 'ArrowUp' || keyboardEvent.key === 'ArrowDown') {
      keyboardEvent.preventDefault();
      const currentValue = clampInteger(
        Number((keyboardEvent.currentTarget as HTMLInputElement).value) || 0,
        0,
        maxQty
      );
      const delta = keyboardEvent.key === 'ArrowUp' ? 1 : -1;
      setQuantityFor(itemId, currentValue + delta, maxQty);
    }
  }

  type InternalSelection = {
    itemId: string;
    amountCents?: number;
    quantity?: number;
  };

  function hasAmount(
    sel: InternalSelection
  ): sel is { itemId: string; amountCents: number } {
    return (
      typeof sel.amountCents === 'number' &&
      Number.isFinite(sel.amountCents) &&
      sel.amountCents > 0
    );
  }

  function hasQuantity(
    sel: InternalSelection
  ): sel is { itemId: string; quantity: number } {
    return (
      typeof sel.quantity === 'number' &&
      Number.isFinite(sel.quantity) &&
      Math.trunc(sel.quantity) > 0
    );
  }

  // Convert to API shape: { type: 'amount'|'quantity', ... }
  type ApiSelection =
    | { type: 'amount'; itemId: string; amountCents: number }
    | { type: 'quantity'; itemId: string; quantity: number };

  async function submitRefund(): Promise<void> {
    if (!order) return;

    // 1) Build internal selections (amount overrides qty)
    const selections = buildSelections({
      refundLines,
      quantitiesByItemId,
      remainingQtyByItemId,
      partialAmountCentsByItemId,
      clamp: clampInteger
    });

    if (selections.length === 0) {
      toast.error(
        'Enter a partial amount or select at least one quantity to refund.'
      );
      return;
    }
    const internalSelections: InternalSelection[] = buildSelections({
      refundLines,
      quantitiesByItemId,
      remainingQtyByItemId,
      partialAmountCentsByItemId,
      clamp: clampInteger
    });

    const apiSelections = internalSelections.reduce<ApiSelection[]>(
      (accumulator, selection) => {
        if (hasAmount(selection)) {
          accumulator.push({
            type: 'amount',
            itemId: selection.itemId,
            amountCents: Math.trunc(selection.amountCents)
          });
          return accumulator;
        }

        if (hasQuantity(selection)) {
          accumulator.push({
            type: 'quantity',
            itemId: selection.itemId,
            quantity: Math.trunc(selection.quantity)
          });
          return accumulator;
        }

        // Invalid selection (neither amount nor quantity) — skip it
        return accumulator;
      },
      []
    );

    if (apiSelections.length === 0) {
      toast.error('Nothing to refund — check amounts/quantities.');
      return;
    }

    // 3) Convert the extra UI money fields to cents (kept here if your API supports them)
    const shippingCents = parseMoneyToCents(refundShippingDollars);
    const restockingCents = parseMoneyToCents(restockingFeeDollars);

    // 4) Idempotency (best-effort)
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
      /* server can generate if needed */
    }

    // 5) Build request body with the expected discriminator
    const body = {
      orderId: order.id,
      reason,
      selections: apiSelections, // <-- uses `type: 'amount'|'quantity'`
      // include these only if your API accepts them; otherwise remove
      // restockingFeeCents: Math.max(0, restockingCents) || undefined,
      // refundShippingCents: Math.max(0, shippingCents) || undefined,
      idempotencyKey
    };

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-ah-debug-refund': 'true'
        },
        body: JSON.stringify(body)
      });

      let json = null;
      try {
        json = await res.json();
      } catch {}

      console.log(
        `[refund] POST /api/admin/refunds → ${res.status}\nBody:`,
        JSON.stringify(body, null, 2),
        '\nResponse:',
        JSON.stringify(json, null, 2)
      );

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

      // Refresh + reset UI
      await refreshAfterRefund(order.id);
      setQuantitiesByItemId({});
      setPartialAmountByItemId({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refund failed.');
    } finally {
      setIsLoading(false);
    }
  }

  // ----- Render guards AFTER hooks -----
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

  // ----- UI -----
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
        {/* Items grid */}
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
              // how many units already refunded (server truth)
              const alreadyRefundedQty =
                typeof refundedQtyByItemId[line.itemId] === 'number'
                  ? refundedQtyByItemId[line.itemId]
                  : 0;

              // how many units still refundable
              const remainingQuantityForLine = Math.max(
                0,
                line.quantityPurchased - (alreadyRefundedQty ?? 0)
              );

              // line total in cents (prefer snapshot total, else unit * qty)
              const lineTotalCents =
                typeof line.amountTotal === 'number'
                  ? line.amountTotal
                  : line.unitAmount * line.quantityPurchased;

              // dollars refunded by amount-based refunds (server truth)
              const refundedAmountForLineCents =
                typeof refundedAmountByItemId[line.itemId] === 'number'
                  ? refundedAmountByItemId[line.itemId]
                  : 0;

              // if the refunded-by-amount fully covers this line
              const isFullyCoveredByAmount =
                (refundedAmountForLineCents ?? 0) >=
                Math.max(0, lineTotalCents - 1);

              // final fully-refunded flag
              const isLineFullyRefunded =
                remainingQuantityForLine === 0 || isFullyCoveredByAmount;

              // current qty input value (clamped to latest remaining from server)
              const selectedQuantity = clampInteger(
                quantitiesByItemId[line.itemId] ?? 0,
                0,
                remainingQuantityForLine
              );

              return (
                <div
                  key={line.itemId}
                  className="ah-refund-row"
                  data-item-id={line.itemId}
                >
                  {/* Col 1: name + chips */}
                  <div className="ah-refund-col ah-refund-col--name">
                    <div className="ah-item-title">
                      {line.name}
                      {isLineFullyRefunded && (
                        <span
                          className="ah-chip ah-chip--muted"
                          style={{ marginLeft: 8 }}
                        >
                          {remainingQuantityForLine === 0
                            ? 'Refunded'
                            : 'Refunded (amount)'}
                        </span>
                      )}
                    </div>

                    {/* show “refunded so far” when partially refunded by amount */}
                    {!isLineFullyRefunded &&
                      (refundedAmountForLineCents ?? 0) > 0 && (
                        <div className="ah-item-meta">
                          Refunded so far:{' '}
                          {formatCurrency(
                            (refundedAmountForLineCents ?? 0) / 100,
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

                  {/* Col 2: qty purchased */}
                  <div className="ah-refund-col ah-refund-col--qty text-right">
                    {line.quantityPurchased}
                  </div>

                  {/* Col 3: qty selector */}
                  <div className="ah-refund-col ah-refund-col--qty">
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="ah-chip-input"
                      min={0}
                      max={remainingQuantityForLine}
                      value={selectedQuantity}
                      disabled={isLineFullyRefunded || isLoading}
                      onKeyDown={(event) =>
                        handleQtyKeyDown(
                          event,
                          line.itemId,
                          remainingQuantityForLine
                        )
                      }
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        setQuantityFor(
                          line.itemId,
                          parsed,
                          remainingQuantityForLine
                        );
                      }}
                      onBlur={(event) => {
                        const parsed = Number(event.target.value);
                        const clamped = clampInteger(
                          parsed,
                          0,
                          remainingQuantityForLine
                        );
                        if (clamped !== parsed) {
                          setQuantityFor(
                            line.itemId,
                            clamped,
                            remainingQuantityForLine
                          );
                        }
                      }}
                    />
                    {remainingQuantityForLine < line.quantityPurchased &&
                      !isLineFullyRefunded && (
                        <div className="ah-mini-hint">
                          Remaining: {remainingQuantityForLine}
                        </div>
                      )}
                  </div>

                  {/* Col 4: partial amount input */}
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
                          value={partialAmountByItemId[line.itemId] ?? ''}
                          onChange={(event) =>
                            setPartialAmountByItemId((previous) => ({
                              ...previous,
                              [line.itemId]: cleanMoneyInput(event.target.value)
                            }))
                          }
                          disabled={isLineFullyRefunded || isLoading}
                        />
                      </div>
                      {(partialAmountCentsByItemId[line.itemId] ?? 0) > 0 && (
                        <div className="ah-mini-hint">Overrides quantity</div>
                      )}
                    </label>
                  </div>

                  {/* Col 5: unit price */}
                  <div className="ah-refund-col ah-refund-col--unit text-right">
                    {formatCurrency(line.unitAmount / 100, currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls (staff enters dollars.cents) */}
        <div className="ah-grid ah-grid-3 ah-refund-grid mt-3">
          <label className="ah-field">
            <span className="ah-mini-label">Reason</span>
            <select
              className="ah-input"
              value={reason}
              onChange={(e) =>
                setReason(
                  e.target.value as
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
                onChange={(e) =>
                  setRefundShippingDollars(cleanMoneyInput(e.target.value))
                }
              />
            </div>
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
                onChange={(e) =>
                  setRestockingFeeDollars(cleanMoneyInput(e.target.value))
                }
              />
            </div>
          </label>
        </div>

        <Separator className="my-3" />

        {/* Summary + Action */}
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
