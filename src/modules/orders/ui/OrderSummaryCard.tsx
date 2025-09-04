'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

type BaseOrderSummaryProps = {
  orderDate: string | Date;
  orderNumber: string;
  returnsAcceptedThrough?: string | Date | null;
  quantity?: number;
  className?: string;
};

// EITHER dollars (your old way) OR cents (from DB/Stripe)
type DollarsVariant = BaseOrderSummaryProps & {
  totalPaid: number; // dollars
  totalCents?: never;
  currency?: never;
};
type CentsVariant = BaseOrderSummaryProps & {
  totalCents: number; // cents
  currency?: string; // optional, reserved for future
  totalPaid?: never;
};

export type OrderSummaryCardProps = DollarsVariant | CentsVariant;

// --- type guards ---
function hasTotalCents(props: OrderSummaryCardProps): props is CentsVariant {
  return typeof (props as CentsVariant).totalCents === 'number';
}
function hasTotalPaid(props: OrderSummaryCardProps): props is DollarsVariant {
  return typeof (props as DollarsVariant).totalPaid === 'number';
}

export function OrderSummaryCard(props: OrderSummaryCardProps) {
  const { orderDate, orderNumber, returnsAcceptedThrough, className } = props;

  let totalDollars: number;
  if (hasTotalCents(props)) {
    totalDollars = props.totalCents / 100;
  } else if (hasTotalPaid(props)) {
    totalDollars = props.totalPaid;
  } else {
    totalDollars = 0; // final fallback; should never happen
  }

  const quantity = props.quantity ?? 1;

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
        <Row label="Total paid" value={formatCurrency(totalDollars)} strong />
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
