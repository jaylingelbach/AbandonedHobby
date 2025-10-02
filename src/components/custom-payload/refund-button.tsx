'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button, useDocumentInfo, useAuth } from '@payloadcms/ui';

import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils';

type OrderItemLite = {
  id?: string;
  quantity?: number;
  refundedTotalCents?: number;
};
type OrderLite = {
  id: string;
  items?: OrderItemLite[];
  refundedTotalCents?: number;
  total: number;
};

/**
 * Render a staff-only button that issues a hard-coded refund for the first item of the currently open order.
 *
 * Renders nothing for non-staff users. When activated, it posts a refund for the order's first item (quantity 1),
 * updates local refunded totals optimistically, and shows success or error toasts.
 *
 * @returns A JSX element for the refund button, or `null` when the current user is not a staff user.
 *
 * @remarks
 * This component only refunds the first item with a quantity of 1 and cannot refund specific items, multiple quantities, or perform full/partial order refunds.
 */
export function RefundButton() {
  const { id, collectionSlug } = useDocumentInfo();
  const { user } = useAuth();

  // --- state we’ll update optimistically ---
  const [loading, setLoading] = useState(false);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [refundedTotal, setRefundedTotal] = useState<number>(0);

  // Build a stable API base: ENV first, then current origin
  const apiBase = useMemo(() => {
    const envUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    return (
      envUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    );
  }, []);

  const isStaff =
    Array.isArray(user?.roles) && user.roles.includes('super-admin');

  // Load minimal order totals once when we have an order open
  useEffect(() => {
    if (!id || collectionSlug !== 'orders') return;

    (async () => {
      try {
        const res = await fetch(`/api/orders/${id}?depth=0`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (!res.ok) return;
        const o = (await res.json()) as OrderLite;
        setOrderTotal(o.total);
        setRefundedTotal(o.refundedTotalCents ?? 0);
      } catch {
        /* no-op */
      }
    })();
  }, [id, collectionSlug]);

  const fullyRefunded = orderTotal != null && refundedTotal >= orderTotal;

  /**
   * Fetches minimal order data for the specified order.
   *
   * @param orderId - The order's ID to retrieve
   * @returns The order as an `OrderLite` if available, `null` if not found or on error.
   */
  async function fetchOrder(orderId: string): Promise<OrderLite | null> {
    try {
      const res = await fetch(`/api/orders/${orderId}?depth=0`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!res.ok) return null;
      return (await res.json()) as OrderLite;
    } catch {
      return null;
    }
  }

  /**
   * Issues a refund for the first item of the currently open order and updates local refund state and UI.
   *
   * Validates that an order is open and loads the latest order totals, posts a refund request for one unit
   * of the first order item, optimistically increments the local refunded total, shows success or error toasts,
   * and re-fetches the order in the background to synchronize totals.
   */
  async function handleRefund() {
    if (!id || collectionSlug !== 'orders') {
      toast.error('Open an order to issue a refund.');
      return;
    }

    setLoading(true);
    try {
      const order = await fetchOrder(String(id));
      if (!order) throw new Error('Could not load order data.');

      // Make sure local state reflects latest server totals before computing optimism
      setOrderTotal(order.total);
      setRefundedTotal(order.refundedTotalCents ?? 0);

      const firstItemId = order.items?.[0]?.id;
      if (!firstItemId) throw new Error('Order has no items to refund.');

      const res = await fetch(`${apiBase}/api/admin/refunds`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: String(order.id),
          selections: [{ itemId: String(firstItemId), quantity: 1 }],
          reason: 'requested_by_customer'
        })
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Refund failed');
      }

      // --- optimistic update: bump refundedTotal locally ---
      const refundedCents = typeof json.amount === 'number' ? json.amount : 0;
      const nextRefunded = (order.refundedTotalCents ?? 0) + refundedCents;
      setRefundedTotal(nextRefunded);

      const formattedAmount = formatCurrency(refundedCents / 100, 'USD');
      toast.success(`Refund created: ${json.status} • ${formattedAmount}`);

      // extra-safe, re-fetch the order in the background:
      void fetch(`/api/orders/${order.id}?depth=0`, {
        credentials: 'include',
        cache: 'no-store'
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((fresh: OrderLite | null) => {
          if (fresh) {
            setOrderTotal(fresh.total);
            setRefundedTotal(fresh.refundedTotalCents ?? 0);
          }
        });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  if (!isStaff) return null;

  return (
    <Button
      onClick={handleRefund}
      disabled={loading || !id || collectionSlug !== 'orders' || fullyRefunded}
      size="medium"
    >
      {fullyRefunded
        ? 'Refunded'
        : loading
          ? 'Issuing refund…'
          : 'Issue refund'}
    </Button>
  );
}

export default RefundButton;
