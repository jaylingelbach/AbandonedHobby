import { CartItemForShipping } from '@/modules/orders/types';
import { formatCurrency } from '@/lib/utils';

export function ShippingBreakdown({ items }: { items: CartItemForShipping[] }) {
  const rows = items
    .filter((item) => item.shippingMode !== 'free')
    .map((item) => {
      const perUnit =
        item.shippingMode === 'flat' ? (item.shippingFeeCentsPerUnit ?? 0) : 0;
      const subtotal =
        item.shippingMode === 'flat' ? perUnit * item.quantity : 0;
      return {
        id: item.id,
        name: item.name,
        mode: item.shippingMode,
        perUnit,
        quantity: item.quantity,
        subtotal
      };
    });

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 text-sm">
      {rows.map((row) => (
        <div key={row.id} className="flex justify-between">
          <span>
            {row.name}{' '}
            {row.mode === 'flat'
              ? `(shipping ${row.quantity} × ${formatCurrency(row.perUnit / 100)})`
              : `(calculated at checkout)`}
          </span>
          <span>
            {row.mode === 'flat' ? formatCurrency(row.subtotal / 100) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
