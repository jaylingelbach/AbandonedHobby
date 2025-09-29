'use client';

import { useEffect, useMemo } from 'react';
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

import { OrderForBuyer, OrderItem } from './types';

export interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderForBuyer | null; // can be null while loading
  productNameFallback: string; // used if order.items is missing
  sellerName: string; // display at top
}

export default function InvoiceDialog(props: InvoiceDialogProps) {
  const { open, onOpenChange, order, productNameFallback, sellerName } = props;
  const currency = (order?.currency ?? 'USD').toUpperCase();

  const lineItems: OrderItem[] = useMemo(() => {
    if (order?.items && order.items.length > 0) return order.items;
    const qty = order?.quantity ?? 1;
    const total = order?.totalCents ?? 0;
    const unit = Math.round(total / Math.max(qty, 1));
    return [
      {
        nameSnapshot: productNameFallback,
        unitAmount: unit,
        quantity: qty,
        amountTotal: total
      }
    ];
  }, [order?.items, order?.quantity, order?.totalCents, productNameFallback]);

  const handlePrint = () => {
    window.print();
  };
  useEffect(() => {
    const after = () => onOpenChange(false);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
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
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Billed to
              </div>
              <div className="whitespace-pre-wrap">
                {compactAddress(order?.shipping) || '—'}
              </div>
              {order?.buyerEmail && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {order.buyerEmail}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Sold by</div>
              <div>{sellerName}</div>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-12 bg-muted px-4 py-2 text-sm font-medium">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            <div className="divide-y">
              {lineItems.map((li, idx) => {
                const qty = li.quantity ?? 1;
                const unit = li.unitAmount ?? 0;
                const total = li.amountTotal ?? unit * qty;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 px-4 py-2 text-sm"
                  >
                    <div className="col-span-6">
                      {li.nameSnapshot ?? productNameFallback}
                    </div>
                    <div className="col-span-2 text-right">{qty}</div>
                    <div className="col-span-2 text-right">
                      {formatCurrency((unit ?? 0) / 100, currency)}
                    </div>
                    <div className="col-span-2 text-right">
                      {formatCurrency(total / 100, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-12 px-4 py-3">
              <div className="col-span-8" />
              <div className="col-span-2 text-right font-medium">Total</div>
              <div className="col-span-2 text-right font-semibold">
                {formatCurrency((order?.totalCents ?? 0) / 100, currency)}
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
            className="border-2 border-black"
            onClick={handlePrint}
          >
            Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
