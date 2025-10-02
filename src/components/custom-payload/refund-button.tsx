'use client';

import { useMemo, useState } from 'react';

import { Button, useDocumentInfo, useAuth } from '@payloadcms/ui';

import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils';

type OrderItemLite = { id?: string; quantity?: number };
type OrderLite = { id: string; items?: OrderItemLite[] };

export function RefundButton() {
  const [isRefunded, setIsRefunded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { id, collectionSlug } = useDocumentInfo();
  const { user } = useAuth();

  // Build a stable API base: ENV first, then current origin
  const apiBase = useMemo(() => {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    return (
      envUrl.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : '')
    );
  }, []);

  const isStaff =
    Array.isArray(user?.roles) && user.roles.includes('super-admin');
  if (!isStaff) return null;

  async function fetchOrder(orderId: string): Promise<OrderLite | null> {
    try {
      const res = await fetch(`/api/orders/${orderId}?depth=0`, {
        credentials: 'include'
      });
      if (!res.ok) return null;
      return (await res.json()) as OrderLite;
    } catch {
      console.error('[fetch order]: failed');
      return null;
    }
  }

  async function handleRefund() {
    if (!id || collectionSlug !== 'orders') {
      toast.error('Open an order to issue a refund.');
      return;
    }

    setLoading(true);
    try {
      const order = await fetchOrder(String(id));
      if (!order) throw new Error('Could not load order data.');
      /* TODO: Hard-coded first item refund limits functionality.
       ** The implementation always refunds only the first item with quantity 1. This is a significant functional constraint that prevents staff from:
       ** Refunding specific items in multi-item orders
       ** Refunding quantities greater than 1
       ** Performing partial or full order refunds
       */
      const firstItemId = order.items?.[0]?.id;
      if (!firstItemId) throw new Error('Order has no items to refund.');

      const url = `${apiBase}/api/admin/refunds`;
      const res = await fetch(url, {
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

      const amount = typeof json.amount === 'number' ? json.amount : 0;
      const formattedAmount = formatCurrency(amount / 100, 'USD');
      toast.success(`Refund created: ${json.status} • ${formattedAmount}`);
      setIsRefunded(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleRefund}
      disabled={loading || !id || collectionSlug !== 'orders' || isRefunded}
      size="medium"
    >
      {loading ? 'Issuing refund…' : 'Issue refund'}
    </Button>
  );
}

export default RefundButton;
