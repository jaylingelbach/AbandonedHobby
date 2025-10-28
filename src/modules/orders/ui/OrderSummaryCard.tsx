'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

import type { OrderSummaryCardProps } from '../types';
import { hasTotalCents, hasTotalPaid } from './utils-client';

type InvoiceActionProps = {
  onViewInvoice?: () => void;
  canViewInvoice?: boolean;
  isInvoiceLoading?: boolean;
};

/**
 * Render an order summary card showing order date, total paid, order number, returns deadline, and shipping address, with an optional inline "View invoice" action.
 *
 * The component formats currency (with a safe fallback if formatting fails) and dates (returns "—" for missing or invalid dates). If `onViewInvoice` and `canViewInvoice` are provided, a small invoice button is displayed and its disabled/busy state follows `isInvoiceLoading`.
 *
 * @returns A JSX element containing the order details card, including any conditional invoice action and shipping block.
 */
export function OrderSummaryCard(
  props: OrderSummaryCardProps & InvoiceActionProps
) {
  const {
    orderDate,
    orderNumber,
    returnsAcceptedThrough,
    className,
    shipping,
    onViewInvoice,
    canViewInvoice = false,
    isInvoiceLoading = false
  } = props;

  const totalDollars = hasTotalCents(props)
    ? props.totalCents / 100
    : hasTotalPaid(props)
      ? props.totalPaid
      : 0;

  const rawCurrency = props.currency ?? 'USD';
  const currencyCode = (rawCurrency || 'USD').toUpperCase();

  let totalFormatted: string;
  try {
    totalFormatted = formatCurrency(totalDollars, currencyCode);
  } catch {
    totalFormatted = `${currencyCode} ${totalDollars.toFixed(2)}`;
  }

  const fmtDate = (d?: string | Date | null) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
      date
    );
  };

  return (
    <Card
      aria-label="Order details"
      className={cn(
        'ah-order-card rounded-xl border-2 border-black bg-white',
        'shadow-[6px_6px_0_0_rgba(0,0,0,1)]',
        'w-full max-w-none',
        className
      )}
      data-variant="neo-brut"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold tracking-tight">
            Order details
          </CardTitle>

          {/* Inline action up top (optional). Remove if you prefer it below. */}
          {onViewInvoice && canViewInvoice && (
            <Button
              size="sm"
              variant="secondary"
              className="border-2 border-black"
              onClick={onViewInvoice}
              disabled={isInvoiceLoading}
              aria-label="View invoice"
              aria-busy={isInvoiceLoading}
            >
              <Receipt className="mr-2 size-4" />
              {isInvoiceLoading ? 'Loading…' : 'View invoice'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 text-sm">
        <Row label="Order date" value={fmtDate(orderDate)} />
        <Row label="Total paid" value={totalFormatted} strong />
        <Row
          label="Order #"
          value={<span className="font-mono">{orderNumber}</span>}
        />
        <Row
          label="Returns accepted through"
          value={fmtDate(returnsAcceptedThrough)}
        />

        {shipping &&
        (shipping.line1 ||
          shipping.line2 ||
          shipping.city ||
          shipping.state ||
          shipping.postalCode ||
          shipping.country ||
          shipping.name) ? (
          <address className="mt-3 border-2 border-black rounded p-3 not-italic">
            <div className="text-xs text-muted-foreground mb-1">
              Shipping to
            </div>
            <div className="font-medium">{shipping.name ?? 'Customer'}</div>
            <div className="mt-0.5 leading-tight">
              {shipping.line1}
              {shipping.line2 ? (
                <>
                  <br />
                  {shipping.line2}
                </>
              ) : null}
              <br />
              <span>
                {shipping.city ? shipping.city : ''}
                {shipping.city && shipping.state ? ', ' : ''}
                {shipping.state ? shipping.state : ''}
                {shipping.city || shipping.state ? ' ' : ''}
                {shipping.postalCode}
              </span>
              <br />
              {shipping.country}
            </div>
          </address>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold' : 'font-medium'}>{value}</span>
    </div>
  );
}