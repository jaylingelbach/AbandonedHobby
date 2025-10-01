'use client';

import { useState } from 'react';
import { Button, useDocumentInfo, useAuth } from '@payloadcms/ui';
import { toast } from 'sonner';

type OrderItemLite = { id?: string; quantity?: number };
type OrderLite = { id: string; items?: OrderItemLite[] };

export function RefundButton() {
  const [isRefunded, setIsRefunded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { id, collectionSlug } = useDocumentInfo();
  const { user } = useAuth();

  const isStaff =
    Array.isArray(user?.roles) && user!.roles.includes('super-admin');
  if (!isStaff) return null;

  // Build a stable API base: ENV first, then current origin
  const apiBase =
    (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  async function fetchOrder(orderId: string): Promise<OrderLite | null> {
    try {
      const res = await fetch(`/api/orders/${orderId}?depth=0`, {
        credentials: 'include'
      });
      if (!res.ok) return null;
      return (await res.json()) as OrderLite;
    } catch {
      console.log('[fetch order]: failed');
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
      const firstItemId = order.items?.[0]?.id;
      if (!firstItemId) throw new Error('Order has no items to refund.');

      const url = `${apiBase}/api/admin/refunds`; // ✅ absolute URL
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

      toast.success(
        `Refund created: ${json.status} • ${(json.amount / 100).toFixed(2)}`
      );
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
