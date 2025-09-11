'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { OrderSummaryCardProps } from '../types';
import { hasTotalCents, hasTotalPaid } from './utils-client';

export function OrderSummaryCard(props: OrderSummaryCardProps) {
  const {
    orderDate,
    orderNumber,
    returnsAcceptedThrough,
    className,
    shipping
  } = props;

  let totalDollars: number;
  if (hasTotalCents(props)) {
    totalDollars = props.totalCents / 100;
  } else if (hasTotalPaid(props)) {
    totalDollars = props.totalPaid;
  } else {
    totalDollars = 0;
  }

  const quantity = Math.max(1, Number(props.quantity ?? 1) || 1);

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
      className={[
        'ah-order-card rounded-xl border-2 border-black bg-white',
        'shadow-[6px_6px_0_0_rgba(0,0,0,1)]',
        'max-w-md',
        className ?? ''
      ].join(' ')}
      data-variant="neo-brut"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold tracking-tight">
          Order details
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-3 text-sm">
        <Row label="Order date" value={fmtDate(orderDate)} />
        <Row label="Quantity" value={quantity} />
        <Row
          label="Total paid"
          value={formatCurrency(
            totalDollars,
            (hasTotalCents(props) && props.currency) || 'USD'
          )}
          strong
        />
        <Row
          label="Order #"
          value={<span className="font-mono">{orderNumber}</span>}
        />
        <Row
          label="Returns accepted through"
          value={fmtDate(returnsAcceptedThrough)}
        />

        {shipping ? (
          <div className="mt-3 border-2 border-black rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">
              Shipping to
            </div>
            {shipping.name ? (
              <div className="font-medium">{shipping.name}</div>
            ) : null}
            <div className="mt-0.5 leading-tight">
              {shipping.line1}
              {shipping.line2 ? (
                <>
                  <br />
                  {shipping.line2}
                </>
              ) : null}
              <br />
              {/* City/state line: only show what exists, with proper separators */}
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
          </div>
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
