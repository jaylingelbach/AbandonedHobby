'use client';

import { useEffect, useState } from 'react';
import { formatCents } from '@/lib/utils';

import { compactAddress } from '../utils';
import type { SellerOrderDetail } from '@/app/(app)/api/seller/orders/[orderId]/detail/types';

export function OrderBreakdownButton(props: {
  orderId: string;
  currency: string;
}) {
  const { orderId, currency: currencyProp } = props;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SellerOrderDetail | null>(null);
  const currency = (detail?.currency ?? currencyProp ?? 'USD').toUpperCase();

  useEffect(() => {
    if (!open) return;
    let isActive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/seller/orders/${orderId}/detail`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        if (!response.ok) throw new Error('Failed to load order');
        const json = (await response.json()) as SellerOrderDetail;
        if (isActive) setDetail(json);
      } catch (error) {
        console.error(error);
        if (isActive)
          setError('Failed to load order details. Please try again.');
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [open, orderId]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <>
      <button className="btn btn--ghost" onClick={() => setOpen(true)}>
        View
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-1000 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border-4 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
              <h2 className="text-xl font-bold">Order Breakdown</h2>
              <button className="btn btn--ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="p-5 space-y-6">
              {loading && <div>Loading…</div>}
              {error && <div className="text-red-600">{error}</div>}
              {!loading && detail && (
                <>
                  {/* Meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs uppercase text-neutral-500">
                        Order #
                      </div>
                      <div className="font-semibold">{detail.orderNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-neutral-500">
                        Placed
                      </div>
                      <div className="font-semibold">
                        {detail.createdAtISO
                          ? new Date(detail.createdAtISO).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-neutral-500">
                        Buyer
                      </div>
                      <div className="font-semibold">
                        {detail.buyerEmail ?? '—'}
                      </div>
                    </div>
                  </div>

                  {/* Shipping / Tracking */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase text-neutral-500 mb-1">
                        Ship to
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {compactAddress(detail.shipping) || '—'}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-neutral-500 mb-1">
                        Tracking
                      </div>
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

                  {/* Items */}
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-12 bg-neutral-100 px-3 py-2 text-sm font-medium">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>
                    <div className="divide-y">
                      {detail.items.map((item, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 px-3 py-2 text-sm"
                        >
                          <div className="col-span-6">{item.nameSnapshot}</div>
                          <div className="col-span-2 text-right">
                            {item.quantity}
                          </div>
                          <div className="col-span-2 text-right">
                            {formatCents(item.unitAmountCents, currency)}
                          </div>
                          <div className="col-span-2 text-right">
                            {formatCents(item.amountTotalCents, currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fees & Net Payout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1 text-sm">
                      <div className="text-base font-semibold">Totals</div>
                      <div className="flex justify-between">
                        <span>Items Subtotal</span>
                        <span>
                          {formatCents(
                            detail.amounts.itemsSubtotalCents,
                            currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>
                          {formatCents(detail.amounts.shippingCents, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Discounts</span>
                        <span>
                          −{formatCents(detail.amounts.discountCents, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>
                          {formatCents(detail.amounts.taxCents, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Gross Total</span>
                        <span>
                          {formatCents(
                            detail.amounts.grossTotalCents,
                            currency
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="text-base font-semibold">
                        Fees & Payout
                      </div>
                      <div className="flex justify-between">
                        <span>Platform Fee</span>
                        <span>
                          −
                          {formatCents(
                            detail.amounts.platformFeeCents,
                            currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Stripe Fee</span>
                        <span>
                          −
                          {formatCents(detail.amounts.stripeFeeCents, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Net Payout</span>
                        <span>
                          {formatCents(detail.amounts.sellerNetCents, currency)}
                        </span>
                      </div>
                      {detail.stripe?.receiptUrl && (
                        <div className="pt-2">
                          <a
                            className="underline"
                            href={detail.stripe.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Stripe receipt
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
