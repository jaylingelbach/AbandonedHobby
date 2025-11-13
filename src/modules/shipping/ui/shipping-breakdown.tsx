import { CartItemForShipping } from '@/modules/orders/types';
import { formatCents } from '@/lib/utils';

/**
 * Render a compact breakdown of shipping charges for cart items that are not free.
 *
 * Filters out items with bshippingMode` of "free" and displays a line per remaining item:
 * for `flat` shipping it shows quantity, per-unit shipping, and the subtotal; for other modes it
 * indicates the shipping will be calculated at checkout.
 *
 * @param items - Cart items to include in the shipping breakdown
 * @returns A JSX element containing a list of shipping rows for non-free items, or `null` if none exist
 */
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
        <div
          key={row.id}
          className="flex justify-between text-muted-foreground"
        >
          <span>
            {row.name}{' '}
            {row.mode === 'flat'
              ? `(shipping ${row.quantity} × ${formatCents(row.perUnit)})`
              : `(calculated at checkout)`}
          </span>
          <span>{row.mode === 'flat' ? formatCents(row.subtotal) : '—'}</span>
        </div>
      ))}
    </div>
  );
}
