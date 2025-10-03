import { OrderWithItems } from './types';

export function dedupeOrdersById<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((order) => [order.id, order])).values());
}

export function computeOrderTitle(o: OrderWithItems): string {
  if (o.name) return o.name;

  const first = o.items?.[0];
  if (!first) return 'Order';

  const base = first.nameSnapshot || 'Order';
  const extra = (o.items?.length ?? 0) - 1;
  return extra > 0 ? `${base} (+${extra} more)` : base;
}

export function computeOrderCover(o: OrderWithItems): string {
  const first = o.items?.[0];
  // Prefer a snapshot if you store it, else fall back to product image, else placeholder
  return first?.imageUrl || first?.product?.image?.url || '/placeholder.png';
}
