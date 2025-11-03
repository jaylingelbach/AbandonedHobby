'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { compactAddress } from '../utils';
import type { SellerOrderDetail } from '@/app/(app)/api/seller/orders/[orderId]/detail/types';

export default function OrderQuickViewController() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const orderId = searchParams.get('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SellerOrderDetail | null>(null);

  const currency = (detail?.currency ?? 'USD').toUpperCase();

  // Fetch when ?view= is set
  useEffect(() => {
    let isActive = true;
    (async () => {
      if (!orderId) {
        setDetail(null);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`/api/seller/orders/${orderId}/detail`, {
          cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to load order');
        const json = (await response.json()) as SellerOrderDetail;
        if (isActive) setDetail(json);
      } catch (error) {
        console.error('[OrderQuickView] load error', error);
        if (isActive) {
          setDetail(null);
          setError('Failed to load order details');
        }
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [orderId]);

  const onClose = useCallback(() => {
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
          {!loading && detail && (
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
                                  rel="noreferrer"
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
                          {detail.items.map((item, index) => (
                            <tr key={index ?? item.nameSnapshot}>
                              <td>{item.nameSnapshot}</td>
                              <td className="ah-col--qty">{item.quantity}</td>
                              <td className="ah-col--unit">
                                {formatCurrency(
                                  item.unitAmountCents / 100,
                                  currency
                                )}
                              </td>
                              <td className="ah-col--line">
                                {formatCurrency(
                                  item.amountTotalCents / 100,
                                  currency
                                )}
                              </td>
                            </tr>
                          ))}
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
                            {formatCurrency(
                              detail.amounts.itemsSubtotalCents / 100,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Shipping</span>
                          <span className="ah-money">
                            {formatCurrency(
                              detail.amounts.shippingCents / 100,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Discounts</span>
                          <span className="ah-money">
                            −
                            {formatCurrency(
                              detail.amounts.discountCents / 100,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Tax</span>
                          <span className="ah-money">
                            {formatCurrency(
                              detail.amounts.taxCents / 100,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row ah-totals__row--em">
                          <span>Gross Total</span>
                          <span className="ah-money">
                            {formatCurrency(
                              detail.amounts.grossTotalCents / 100,
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
                            {formatCurrency(
                              detail.amounts.platformFeeCents / 100,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row">
                          <span>Stripe Fee</span>
                          <span className="ah-money">
                            −
                            {formatCurrency(
                              detail.amounts.stripeFeeCents / 100,
                              currency
                            )}
                          </span>
                        </div>
                        <div className="ah-totals__row ah-totals__row--strong">
                          <span>Net Payout</span>
                          <span className="ah-money">
                            {formatCurrency(
                              detail.amounts.sellerNetCents / 100,
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
                              rel="noreferrer"
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
