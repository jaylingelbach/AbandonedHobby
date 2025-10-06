'use client';

import { useEffect, useMemo, useState, KeyboardEvent } from 'react';
import { useAuth, useDocumentInfo } from '@payloadcms/ui';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

import type { OrderItemLite, OrderLite, RefundLine } from './types';
import {
  buildClientIdempotencyKeyV2,
  clampInteger,
  cleanMoneyInput,
  parseMoneyToCents,
} from './utils/ui/utils';

export function RefundManager() {
  const { id: documentId, collectionSlug } = useDocumentInfo();
  const { user } = useAuth();

  // ----- Local state -----
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<OrderLite | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [formError, setFormError] = useState<string | null>(null);

  // (B) server-truth remaining quantities by item
  const [remainingQtyByItemId, setRemainingQtyByItemId] = useState<
    Record<string, number>
  >({});

  // (C) server-truth remaining refundable cents for the whole order
  const [remainingCentsFromServer, setRemainingCentsFromServer] = useState<
    number | null
  >(null);

  // refund form state
  const [quantitiesByItemId, setQuantitiesByItemId] = useState<
    Record<string, number>
  >({});
  const [reason, setReason] = useState<
    'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other'
  >('requested_by_customer');

  // Staff types in dollars.cents; we convert to cents for math & API
  const [refundShippingDollars, setRefundShippingDollars] =
    useState<string>('0.00');
  const [restockingFeeDollars, setRestockingFeeDollars] =
    useState<string>('0.00');

  // Guards (do not return early before hooks)
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
      if (!response.ok) return;
      const json = (await response.json()) as {
        ok?: boolean;
        byItemId?: Record<string, number>;
        remainingCents?: number;
      };
      if (!json?.ok) return;
      setRemainingQtyByItemId(json.byItemId ?? {});
      setRemainingCentsFromServer(
        typeof json.remainingCents === 'number' ? json.remainingCents : null
      );
    } catch {
      // ignore network hiccups; UI will still prevent invalid refunds
    }
  }

  async function refreshAfterRefund(orderId: string): Promise<void> {
    // 1) refresh order totals
    const orderResponse = await fetch(`/api/orders/${orderId}?depth=0`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (orderResponse.ok) {
      const updatedOrder: OrderLite = await orderResponse.json();
      setOrder(updatedOrder);
    }

    // 2) refresh remaining (order-level cents + per-item remaining qty)
    await fetchRemainingForOrder(orderId);
  }

  // ----- Effects (not conditional) -----

  // initial load for remaining-per-item + remaining cents
  useEffect(() => {
    if (!documentId || !isOrdersCollection) return;
    void fetchRemainingForOrder(String(documentId));
  }, [documentId, isOrdersCollection]);

  // load order
  useEffect(() => {
    let isAborted = false;
    async function load() {
      if (!documentId || !isOrdersCollection) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/orders/${documentId}?depth=0`, {
          credentials: 'include',
          cache: 'no-store',
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
  const refundedTotalCents = order?.refundedTotalCents ?? 0;
  const remainingRefundableCentsLocal = Math.max(
    0,
    (order?.total ?? 0) - refundedTotalCents
  );
  const effectiveRemainingRefundableCents =
    typeof remainingCentsFromServer === 'number'
      ? remainingCentsFromServer
      : remainingRefundableCentsLocal;

  const refundLines: RefundLine[] = useMemo(() => {
    const items = order?.items ?? [];
    return items
      .filter((orderItem): orderItem is Required<OrderItemLite> =>
        Boolean(orderItem?.id)
      )
      .map((orderItem) => {
        const quantityPurchased =
          typeof orderItem.quantity === 'number' ? orderItem.quantity : 1;
        const unitAmount =
          typeof orderItem.unitAmount === 'number'
            ? orderItem.unitAmount
            : Math.round(
                (orderItem.amountTotal ?? 0) / Math.max(quantityPurchased, 1)
              );
        return {
          itemId: String(orderItem.id),
          name: orderItem.nameSnapshot ?? 'Item',
          unitAmount, // cents
          quantityPurchased,
          quantitySelected: 0,
          amountTotal: orderItem.amountTotal, // cents
        };
      });
  }, [order]);

  const itemsSubtotalCents = useMemo(() => {
    return refundLines.reduce((runningTotal, line) => {
      const remainingQtyForLine =
        remainingQtyByItemId[line.itemId] ?? line.quantityPurchased;
      const selectedQty = clampInteger(
        quantitiesByItemId[line.itemId] ?? 0,
        0,
        remainingQtyForLine
      );
      if (selectedQty === 0) return runningTotal;

      const fullLineTotal =
        typeof line.amountTotal === 'number'
          ? line.amountTotal
          : line.unitAmount * line.quantityPurchased;

      const prorated = Math.round(
        (fullLineTotal * selectedQty) / line.quantityPurchased
      );
      return runningTotal + prorated;
    }, 0);
  }, [refundLines, quantitiesByItemId, remainingQtyByItemId]);

  // Convert staff-entered dollars → cents for math and preview
  const refundShippingCentsValue = useMemo(
    () => parseMoneyToCents(refundShippingDollars),
    [refundShippingDollars]
  );
  const restockingFeeCentsValue = useMemo(
    () => parseMoneyToCents(restockingFeeDollars),
    [restockingFeeDollars]
  );

  const previewCents = useMemo(() => {
    return (
      itemsSubtotalCents +
      Math.max(0, refundShippingCentsValue) -
      Math.max(0, restockingFeeCentsValue)
    );
  }, [itemsSubtotalCents, refundShippingCentsValue, restockingFeeCentsValue]);

  const isFullyRefunded =
    effectiveRemainingRefundableCents <= 0 && (order?.total ?? 0) > 0;

  // form-level overage guard based on server-remaining cents when available
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
      [itemId]: clampInteger(next, 0, maxQty),
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

  async function submitRefund(): Promise<void> {
    if (!order) return;

    // Build validated selections (clamp to remaining-per-item)
    const selections = Object.entries(quantitiesByItemId)
      .map(([itemId, quantity]) => {
        const remainingQty =
          remainingQtyByItemId[itemId] ??
          refundLines.find((line) => line.itemId === itemId)
            ?.quantityPurchased ??
          0;
        return {
          itemId,
          quantity: clampInteger(
            Number(quantity) || 0,
            0,
            Math.max(0, remainingQty)
          ),
        };
      })
      .filter((selection) => selection.quantity > 0);

    if (selections.length === 0) {
      toast.error('Select at least one item/quantity to refund.');
      return;
    }

    // Dollars (UI) → cents (Stripe)
    const shippingCents = refundShippingCentsValue;
    const restockingCents = restockingFeeCentsValue;

    // Correct idempotency payload (shipping ↔ restocking not swapped)
    let idempotencyKey: string | undefined = undefined;
    try {
      idempotencyKey = await buildClientIdempotencyKeyV2({
        orderId: order.id,
        selections,
        options: {
          reason,
          restockingFeeCents: restockingCents,
          refundShippingCents: shippingCents,
        },
      });
    } catch {
      // engine will generate a server-side key if needed
    }

    setIsLoading(true);
    try {
      const requestBody = {
        orderId: order.id,
        selections,
        reason,
        restockingFeeCents: Math.max(0, restockingCents) || undefined,
        refundShippingCents: Math.max(0, shippingCents) || undefined,
        idempotencyKey,
      };

      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-ah-debug-refund': 'true',
        },
        body: JSON.stringify(requestBody),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        stripeRefundId?: string;
        status?: string;
        amount?: number;
        refundId?: string;
        error?: string;
        code?: 'ALREADY_FULLY_REFUNDED' | 'EXCEEDS_REMAINING' | 'FORBIDDEN';
      };

      if (!response.ok || !result.ok) {
        const friendlyMessage =
          result?.code === 'EXCEEDS_REMAINING'
            ? 'Refund exceeds remaining refundable amount.'
            : result?.code === 'ALREADY_FULLY_REFUNDED'
              ? 'Order already fully refunded.'
              : result?.code === 'FORBIDDEN'
                ? 'You must be staff to issue refunds.'
                : result?.error || `Refund failed (HTTP ${response.status}).`;
        toast.error(friendlyMessage);
        return;
      }

      toast.success(
        `Refund ${result.status}: ${formatCurrency(
          (result.amount ?? 0) / 100,
          currency
        )}`
      );

      // Refresh order totals + remaining maps (server truth)
      await refreshAfterRefund(order.id);

      // Reset line selections; keep money fields for convenience
      setQuantitiesByItemId({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund failed.');
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
                  (order.refundedTotalCents ?? 0) / 100,
                  currency
                )}
              </strong>{' '}
              of {formatCurrency(order.total / 100, currency)}
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
          <div className="ah-refund-body">
            {refundLines.map((line) => {
              const remainingQtyForLine =
                remainingQtyByItemId[line.itemId] ?? line.quantityPurchased;
              const selectedQty = clampInteger(
                quantitiesByItemId[line.itemId] ?? 0,
                0,
                remainingQtyForLine
              );
              const isLineFullyRefunded = remainingQtyForLine === 0;

              return (
                <div
                  key={line.itemId}
                  className="ah-refund-row"
                  data-item-id={line.itemId}
                >
                  <div className="ah-refund-col ah-refund-col--name">
                    <div className="ah-item-title">
                      Item: {line.name}
                      {isLineFullyRefunded && (
                        <span
                          className="ah-chip ah-chip--muted"
                          style={{ marginLeft: 8 }}
                        >
                          Refunded
                        </span>
                      )}
                    </div>
                    <div className="ah-item-meta">
                      Cost:{' '}
                      {formatCurrency(
                        (line.amountTotal ?? line.unitAmount) / 100,
                        currency
                      )}
                    </div>
                  </div>

                  <div className="ah-refund-col ah-refund-col--qty text-right">
                    QTY Purchased: {line.quantityPurchased}
                  </div>

                  <div className="ah-refund-col ah-refund-col--qty">
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`Refund quantity for ${line.name}`}
                      className="ah-chip-input"
                      min={0}
                      max={remainingQtyForLine}
                      value={selectedQty}
                      disabled={isLineFullyRefunded || isLoading}
                      title={
                        isLineFullyRefunded
                          ? 'This line item has already been fully refunded.'
                          : undefined
                      }
                      onKeyDown={(keyboardEvent) =>
                        handleQtyKeyDown(
                          keyboardEvent,
                          line.itemId,
                          remainingQtyForLine
                        )
                      }
                      onChange={(changeEvent) => {
                        const parsedValue = Number(changeEvent.target.value);
                        setQuantityFor(
                          line.itemId,
                          parsedValue,
                          remainingQtyForLine
                        );
                      }}
                      onBlur={(blurEvent) => {
                        const parsedValue = Number(blurEvent.target.value);
                        const clampedValue = clampInteger(
                          parsedValue,
                          0,
                          remainingQtyForLine
                        );
                        if (clampedValue !== parsedValue) {
                          setQuantityFor(
                            line.itemId,
                            clampedValue,
                            remainingQtyForLine
                          );
                        }
                      }}
                    />
                    {remainingQtyForLine < line.quantityPurchased &&
                      !isLineFullyRefunded && (
                        <div className="ah-mini-hint">
                          Remaining: {remainingQtyForLine}
                        </div>
                      )}
                  </div>

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
              onChange={(changeEvent) =>
                setReason(
                  changeEvent.target.value as
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
                className="ah-input ah-money-input"
                inputMode="decimal"
                placeholder="0.00"
                value={refundShippingDollars}
                onChange={(changeEvent) =>
                  setRefundShippingDollars(
                    cleanMoneyInput(changeEvent.target.value)
                  )
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
                disabled
                className="ah-input ah-money-input"
                inputMode="decimal"
                placeholder="0.00"
                value={restockingFeeDollars}
                onChange={(changeEvent) =>
                  setRestockingFeeDollars(
                    cleanMoneyInput(changeEvent.target.value)
                  )
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
              <span className="ah-summary-label">Items subtotal</span>
              <span className="ah-summary-value">
                {formatCurrency(itemsSubtotalCents / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-row">
              <span className="ah-summary-label">+ Refund shipping</span>
              <span className="ah-summary-value">
                {formatCurrency(refundShippingCentsValue / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-row">
              <span className="ah-summary-label">− Restocking fee</span>
              <span className="ah-summary-value">
                {formatCurrency(restockingFeeCentsValue / 100, currency)}
              </span>
            </div>
            <div className="ah-summary-divider" />
            <div className="ah-summary-row ah-summary-total">
              <span className="ah-summary-label">Amount to be refunded </span>
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
