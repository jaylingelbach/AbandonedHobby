'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatCents, formatCurrency } from '@/lib/utils';
import { compactAddress } from '../utils';
import type { SellerOrderDetail } from '@/app/(app)/api/seller/orders/[orderId]/detail/types';
import { toIntCents } from '@/lib/money';

export default function OrderQuickViewController() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const orderId = searchParams.get('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SellerOrderDetail | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const currency = (detail?.currency ?? 'USD').toUpperCase();

  // Fetch when ?view= is set
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    (async () => {
      if (!orderId) {
        setDetail(null);
        setError(null); // clear when closing/removing ?view
        return;
      }
      setLoading(true);
      setError(null); // clear stale error on new load
      try {
        const response = await fetch(`/api/seller/orders/${orderId}/detail`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) {
          const message =
            response.status === 404
              ? 'Order not found.'
              : `Failed to load order (HTTP ${response.status}).`;
          throw new Error(message);
        }
        const json = (await response.json()) as SellerOrderDetail;
        if (isActive) setDetail(json);
      } catch (err: unknown) {
        console.error('[OrderQuickView] load error', err);
        if (isActive) {
          setDetail(null);
          const fallback =
            err instanceof Error ? err.message : 'Failed to load order.';
          setError(fallback);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [orderId, reloadTick]);

  const onRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadTick((t) => t + 1);
  }, []);

  const onClose = useCallback(() => {
    setError(null); // clear error when closing
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    const next = params.size ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [pathname, router, searchParams]);

  // Close on ESC
  useEffect(() => {
    if (!orderId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [orderId, onClose]);

  // No view param? Render nothing.
  if (!orderId) return null;

  const content = (
    <div
      className="ah-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className="ah-modal__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ah-modal__head">
          <h2 id="modal-title" className="text-xl font-bold">
            Order Breakdown
          </h2>
          <button
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Close modal"
          >
            Close
          </button>
        </div>

        <div className="ah-modal__body">
          {loading && <div>Loading…</div>}

          {!loading && error && (
            <div
              role="alert"
              aria-live="assertive"
              className="ah-card border-red-500 bg-red-50 text-red-900"
            >
              <div className="ah-card__body flex items-start justify-between gap-3">
                <div>{error}</div>
                <div className="flex gap-2">
                  <button className="btn btn--ghost" onClick={onRetry}>
                    Retry
                  </button>
                  <button className="btn btn--ghost" onClick={onClose}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && detail && (
            <div className="space-y-4">
              {/* Header meta */}
              <div className="ah-card">
                <div className="ah-card__body">
                  <div className="ah-head-grid">
                    <div>
                      <div className="ah-meta-label">Order #</div>
                      <div className="ah-meta-value">
                        {detail.orderNumber ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div className="ah-meta-label">Placed</div>
                      <div className="ah-meta-value">
                        {detail.createdAtISO
                          ? new Date(detail.createdAtISO).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="ah-meta-label">Buyer</div>
                      <div className="ah-meta-value">
                        {detail.buyerEmail ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two column content */}
              <div className="ah-section-grid">
                {/* Left: Shipping + Items table */}
                <div className="space-y-4">
                  <div className="ah-card">
                    <div className="ah-card__head">Shipping / Tracking</div>
                    <div className="ah-card__body">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="ah-meta-label mb-1">Ship to</div>
                          <div className="ah-address">
                            {compactAddress(detail.shipping) || '—'}
                          </div>
                        </div>
                        <div>
                          <div className="ah-meta-label mb-1">Tracking</div>
                          {detail.tracking?.trackingNumber ? (
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="font-medium">
                                  {detail.tracking.carrier?.toUpperCase() ??
                                    'CARRIER'}
                                </span>{' '}
                                • {detail.tracking.trackingNumber}
                              </div>
                              {detail.tracking.trackingUrl && (
                                <a
                                  className="underline"
                                  href={detail.tracking.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Open tracking
                                </a>
                              )}
                              {detail.tracking.shippedAtISO && (
                                <div>
                                  Shipped:{' '}
                                  {new Date(
                                    detail.tracking.shippedAtISO
                                  ).toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm">—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ah-card">
                    <div className="ah-card__head">Items</div>
                    <div className="ah-card__body">
                      <table className="ah-table ah-table--compact">
                        <colgroup>
                          <col />
                          <col className="ah-col--qty" />
                          <col className="ah-col--unit" />
                          <col className="ah-col--line" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th className="ah-col--qty">Qty</th>
                            <th className="ah-col--unit">Unit</th>
                            <th className="ah-col--line">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.items.map((item, index) => {
                            const isFlatShipping = item.shippingMode === 'flat';
                            const isCalculatedShipping =
                              item.shippingMode === 'calculated';

                            // safe, non-negative integers
                            const shippingSubtotalCentsSafe = toIntCents(
                              item.shippingSubtotalCents
                            );
                            const perUnitCentsSafe = toIntCents(
                              item.shippingFeeCentsPerUnit
                            );

                            // only show the per-unit × qty hint when flat and quantity > 1
                            const flatPerUnitHint =
                              isFlatShipping && item.quantity > 1
                                ? ` (${item.quantity} × ${formatCents(perUnitCentsSafe, currency)})`
                                : '';

                            return (
                              <Fragment key={`${item.lineItemId}-${index}`}>
                                {/* Primary item row */}
                                <tr>
                                  <td>{item.nameSnapshot}</td>
                                  <td className="ah-col--qty">
                                    {item.quantity}
                                  </td>
                                  <td className="ah-col--unit">
                                    {formatCents(
                                      item.unitAmountCents,
                                      currency
                                    )}
                                  </td>
                                  <td className="ah-col--line">
                                    {formatCents(
                                      item.amountTotalCents,
                                      currency
                                    )}
                                  </td>
                                </tr>

                                {/* Secondary shipping row (muted) — only when it’s not free */}
                                {(isFlatShipping || isCalculatedShipping) && (
                                  <tr
                                    className="text-xs text-muted-foreground"
                                    key={`${item.lineItemId}-ship`}
                                  >
                                    <td colSpan={4}>
                                      <span className="font-medium">
                                        Shipping:
                                      </span>{' '}
                                      {isFlatShipping
                                        ? `${formatCents(shippingSubtotalCentsSafe, currency)}${flatPerUnitHint}`
                                        : 'Calculated at checkout'}
                                    </td>
                                  </tr>
                                )}

                                {/* Optional divider row for readability */}
                                <tr aria-hidden key={`${item.lineItemId}-sep`}>
                                  <td colSpan={4} className="py-1" />
                                </tr>
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right: Totals / Fees */}
                <div className="space-y-4">
                  <div className="ah-card">
                    <div className="ah-card__head">Totals</div>
                    <div className="ah-card__body">
                      <div className="ah-totals">
                        <div className="ah-totals__row">
                          <span>Items Subtotal</span>
                          <span className="ah-money">
                            {formatCents(
                              detail.amounts.itemsSubtotalCents,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Shipping</span>
                          <span className="ah-money">
                            {formatCents(
                              detail.amounts.shippingCents,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Discounts</span>
                          <span className="ah-money">
                            −
                            {formatCents(
                              detail.amounts.discountCents,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Tax</span>
                          <span className="ah-money">
                            {formatCents(detail.amounts.taxCents, currency)}
                          </span>
                        </div>
                        <div className="ah-totals__row ah-totals__row--em">
                          <span>Gross Total</span>
                          <span className="ah-money">
                            {formatCents(
                              detail.amounts.grossTotalCents,
                              currency
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ah-card">
                    <div className="ah-card__head">Fees &amp; Payout</div>
                    <div className="ah-card__body">
                      <div className="ah-totals">
                        <div className="ah-totals__row">
                          <span>Platform Fee</span>
                          <span className="ah-money">
                            −
                            {formatCents(
                              detail.amounts.platformFeeCents,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Stripe Fee</span>
                          <span className="ah-money">
                            −
                            {formatCents(
                              detail.amounts.stripeFeeCents,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row ah-totals__row--strong">
                          <span>Net Payout</span>
                          <span className="ah-money">
                            {formatCents(
                              detail.amounts.sellerNetCents,
                              currency
                            )}
                          </span>
                        </div>

                        <div className="ah-totals__footer">
                          {detail.stripe?.receiptUrl && (
                            <a
                              className="underline"
                              href={detail.stripe.receiptUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              View Stripe receipt
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Right */}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render into body for true modal layering over Payload admin
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
