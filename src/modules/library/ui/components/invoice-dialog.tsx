'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import { formatCurrency } from '@/lib/utils';
import { compactAddress } from './utils';

// NOTE: The exported UI type doesn't have shippingSubtotalCents.
// Extend it locally to avoid `any` and keep strict typing.
import { OrderForBuyer, OrderItem } from './types';
import { PublicAmountsDTO } from '@/modules/orders/types';
type InvoiceOrderItem = OrderItem & { shippingSubtotalCents?: number | null };
type InvoiceOrder = OrderForBuyer & { amounts?: PublicAmountsDTO };

function computeFallbackAmounts(
  order: OrderForBuyer,
  items: Array<{
    unitAmount?: number;
    quantity?: number;
    amountSubtotal?: number;
    amountTax?: number;
  }>
): PublicAmountsDTO {
  const subtotalCents = items.reduce((sum, li) => {
    // prefer explicit subtotal; fallback to unit * qty
    const qty = li.quantity ?? 1;
    const unit = li.unitAmount ?? 0;
    const sub =
      typeof li.amountSubtotal === 'number' ? li.amountSubtotal : unit * qty;
    return sum + Math.max(0, sub | 0);
  }, 0);

  const taxTotalCents = items.reduce((sum, li) => {
    const n = typeof li.amountTax === 'number' ? li.amountTax : 0;
    return sum + Math.max(0, n | 0);
  }, 0);

  // We don’t have discount/shipping on the base OrderForBuyer type.
  // Keep shipping at 0 here; we’ll still show per-line shipping if you extended items locally.
  const shippingTotalCents = 0;
  const discountTotalCents = 0;

  const totalCents = order.totalCents ?? 0;

  return {
    subtotalCents,
    shippingTotalCents,
    discountTotalCents,
    taxTotalCents,
    totalCents
  };
}

export interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderForBuyer | null; // can be null while loading
  productNameFallback: string;
  sellerName: string;
  sellerEmail: string;
}

export default function InvoiceDialog(props: InvoiceDialogProps) {
  const {
    open,
    onOpenChange,
    order,
    productNameFallback,
    sellerName,
    sellerEmail
  } = props;

  const [isDownloading, setIsDownloading] = useState(false);
  const currency = (order?.currency ?? 'USD').toUpperCase();

  // Prefer server-provided items; otherwise synthesize a single fallback line.
  const lineItems: InvoiceOrderItem[] = useMemo(() => {
    if (Array.isArray(order?.items) && order.items.length > 0) {
      return order.items as InvoiceOrderItem[];
    }
    const quantity = order?.quantity ?? 1;
    const totalCents = order?.totalCents ?? 0;
    const unitCents = Math.round(totalCents / Math.max(quantity, 1));
    return [
      {
        nameSnapshot: productNameFallback,
        unitAmount: unitCents,
        quantity,
        amountTotal: totalCents
      }
    ];
  }, [order?.items, order?.quantity, order?.totalCents, productNameFallback]);

  // Amounts: prefer server-provided, otherwise compute a sane fallback
  const amounts: PublicAmountsDTO = useMemo(() => {
    const invoiceOrder = order as InvoiceOrder | null;
    if (!invoiceOrder) {
      return {
        subtotalCents: 0,
        shippingTotalCents: 0,
        discountTotalCents: 0,
        taxTotalCents: 0,
        totalCents: 0
      };
    }
    if (invoiceOrder.amounts) return invoiceOrder.amounts;
    return computeFallbackAmounts(invoiceOrder, lineItems);
  }, [order, lineItems]);

  async function downloadInvoice(orderId: string) {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/invoice`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to generate invoice');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Successfully downloaded PDF');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  useEffect(() => {
    const after = () => onOpenChange(false);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, [onOpenChange]);

  const subtotalCents = amounts.subtotalCents ?? 0;
  const shippingTotalCents = amounts.shippingTotalCents ?? 0;
  const taxTotalCents = amounts.taxTotalCents ?? 0;
  const discountTotalCents = amounts.discountTotalCents ?? 0;
  const grandTotalCents = amounts.totalCents ?? order?.totalCents ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Invoice</DialogTitle>
        </DialogHeader>

        <div id="invoice-content" className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">Abandoned Hobby</h2>
              <p className="text-sm text-muted-foreground">{sellerName}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Order #</div>
              <div className="font-semibold">{order?.orderNumber ?? '—'}</div>
              <div className="mt-2 text-sm text-muted-foreground">Date</div>
              <div className="font-medium">
                {order?.orderDateISO
                  ? new Date(order.orderDateISO).toLocaleDateString()
                  : '—'}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground mb-1">
                Billed to
              </div>
              <div className="whitespace-pre-wrap break-words">
                {compactAddress(order?.shipping) || '—'}
              </div>
              {order?.buyerEmail && (
                <div
                  className="mt-2 text-sm text-muted-foreground min-w-0 break-words sm:max-w-[260px] md:max-w-none"
                  title={order.buyerEmail}
                >
                  {order.buyerEmail}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm text-muted-foreground mb-1">Sold by</div>
              <div className="min-w-0 break-words">{sellerName}</div>
              <div
                className="min-w-0 break-words sm:max-w-[260px] md:max-w-none"
                title={sellerEmail}
              >
                {sellerEmail}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-12 bg-muted px-4 py-2 text-sm font-medium">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            <div className="divide-y">
              {lineItems.map((lineItem, index) => {
                const quantity = lineItem.quantity ?? 1;
                const unitCents = lineItem.unitAmount ?? 0;
                const lineTotalCents =
                  lineItem.amountTotal ?? unitCents * quantity;

                return (
                  <div key={index} className="px-4 py-2">
                    <div className="grid grid-cols-12 text-sm">
                      <div className="col-span-6">
                        {lineItem.nameSnapshot ?? productNameFallback}
                      </div>
                      <div className="col-span-2 text-right">{quantity}</div>
                      <div className="col-span-2 text-right">
                        {formatCurrency(unitCents / 100, currency)}
                      </div>
                      <div className="col-span-2 text-right">
                        {formatCurrency(lineTotalCents / 100, currency)}
                      </div>
                    </div>

                    {/* Optional per-line shipping */}
                    {typeof lineItem.shippingSubtotalCents === 'number' &&
                      lineItem.shippingSubtotalCents > 0 && (
                        <div className="mt-1 grid grid-cols-12 text-xs text-muted-foreground">
                          <div className="col-span-8" />
                          <div className="col-span-2 text-right">
                            Shipping (line)
                          </div>
                          <div className="col-span-2 text-right">
                            {formatCurrency(
                              lineItem.shippingSubtotalCents / 100,
                              currency
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>

            {/* Summary using server-authoritative amounts */}
            <div className="grid grid-cols-12 px-4 py-3 gap-y-1">
              <div className="col-span-8" />
              <div className="col-span-2 text-right text-sm text-muted-foreground">
                Subtotal
              </div>
              <div className="col-span-2 text-right">
                {formatCurrency(subtotalCents / 100, currency)}
              </div>

              <div className="col-span-8" />
              <div className="col-span-2 text-right text-sm text-muted-foreground">
                Shipping
              </div>
              <div className="col-span-2 text-right">
                {formatCurrency(shippingTotalCents / 100, currency)}
              </div>

              <div className="col-span-8" />
              <div className="col-span-2 text-right text-sm text-muted-foreground">
                Tax
              </div>
              <div className="col-span-2 text-right">
                {formatCurrency(taxTotalCents / 100, currency)}
              </div>

              {discountTotalCents > 0 && (
                <>
                  <div className="col-span-8" />
                  <div className="col-span-2 text-right text-sm text-muted-foreground">
                    Discount
                  </div>
                  <div className="col-span-2 text-right">
                    {formatCurrency(-(discountTotalCents / 100), currency)}
                  </div>
                </>
              )}

              <div className="col-span-12">
                <hr className="my-2" />
              </div>

              <div className="col-span-8" />
              <div className="col-span-2 text-right font-medium">Total</div>
              <div className="col-span-2 text-right font-semibold">
                {formatCurrency(grandTotalCents / 100, currency)}
              </div>
            </div>
          </div>

          {order?.returnsAcceptedThroughISO && (
            <p className="text-xs text-muted-foreground">
              Returns accepted through{' '}
              {new Date(order.returnsAcceptedThroughISO).toLocaleDateString()}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="secondary"
            className="border-2 border-black"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => order && downloadInvoice(order.id)}
            disabled={!order || isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
