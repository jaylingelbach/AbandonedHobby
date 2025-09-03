'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

type OrderSummaryCardProps = {
  orderDate: string | Date;
  totalPaid: number; // in USD (dollars)
  orderNumber: string;
  returnsAcceptedThrough?: string | Date | null;
  className?: string;
};

export function OrderSummaryCard({
  orderDate,
  totalPaid,
  orderNumber,
  returnsAcceptedThrough,
  className
}: OrderSummaryCardProps) {
  const fmtDate = (d?: string | Date | null) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
      date
    );
  };

  return (
    <Card
      aria-label="Order details"
      className={[
        // neo-brutalism: thick border + offset hard shadow
        'ah-order-card rounded-xl border-2 border-black bg-white',
        'shadow-[6px_6px_0_0_rgba(0,0,0,1)]',
        // keep spacing compact so it feels “small”
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
        <Row label="Total paid" value={formatCurrency(totalPaid)} strong />
        <Row
          label="Order #"
          value={<span className="font-mono">{orderNumber}</span>}
        />
        <Row
          label="Returns accepted through"
          value={fmtDate(returnsAcceptedThrough)}
        />
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
