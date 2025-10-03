import { OrderWithItems } from './types';

/**
 * Remove duplicate items by `id`, keeping the last occurrence for each `id` while preserving the original order of first appearances.
 *
 * @param rows - Array of objects that contain an `id` string
 * @returns An array containing one item per unique `id`: the last occurrence for that `id`, in the order their `id` values first appear in `rows`
 */
export function dedupeOrdersById<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((order) => [order.id, order])).values());
}

/**
 * Compute a human-readable title for an order.
 *
 * @param o - The order (including its items) to produce a title for
 * @returns The order's `name` if present; otherwise the first item's `nameSnapshot` or `"Order"`, with `" (+N more)"` appended when the order contains additional items
 */
export function computeOrderTitle(o: OrderWithItems): string {
  if (o.name) return o.name;

  const first = o.items?.[0];
  if (!first) return 'Order';

  const base = first.nameSnapshot || 'Order';
  const extra = (o.items?.length ?? 0) - 1;
  return extra > 0 ? `${base} (+${extra} more)` : base;
}

/**
 * Selects a cover image URL for an order.
 *
 * @param o - The order containing items from which to derive a cover image
 * @returns The chosen cover image URL: the first item's `imageUrl` if present, otherwise the first item's product image URL, otherwise `'/placeholder.png'`
 */
export function computeOrderCover(o: OrderWithItems): string {
  const first = o.items?.[0];
  // Prefer a snapshot if you store it, else fall back to product image, else placeholder
  return first?.imageUrl || first?.product?.image?.url || '/placeholder.png';
}
