'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { z } from 'zod';

const carriers = ['usps', 'ups', 'fedex', 'other'] as const;
type Carrier = (typeof carriers)[number];

const FormSchema = z.object({
  carrier: z.enum(carriers),
  trackingNumber: z.string().trim().min(1, 'Tracking number is required')
});

type InlineTrackingFormProps = {
  orderId: string;
  initialCarrier?: Carrier;
  initialTracking?: string;
  apiBase?: string; // default '/api'
  onSuccess?: (next: { carrier: Carrier; trackingNumber: string }) => void;
  layout?: 'inline' | 'stacked';
};

export function InlineTrackingForm(props: InlineTrackingFormProps) {
  const {
    orderId,
    initialCarrier = 'usps',
    initialTracking = '',
    apiBase = '/api',
    onSuccess,
    layout = 'stacked' // ⬅️ default to stacked
  } = props;

  const [carrier, setCarrier] = useState<Carrier>(initialCarrier);
  const [trackingNumber, setTrackingNumber] = useState<string>(initialTracking);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    setSuccess(null);

    const parsed = FormSchema.safeParse({ carrier, trackingNumber });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    try {
      // Validate orderId format (adjust regex based on your ID format)
      if (!/^[a-zA-Z0-9_-]+$/.test(orderId)) {
        throw new Error('Invalid order ID format');
      }

      const res = await fetch(
        `${apiBase}/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            shipment: { carrier, trackingNumber }
          })
        }
      );

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        let errorMessage = `Failed with ${res.status}`;

        if (contentType?.includes('application/json')) {
          try {
            const json = await res.json();
            errorMessage = json.message || json.error || errorMessage;
          } catch {}
        } else if (contentType?.includes('text/plain')) {
          errorMessage = await res.text().catch(() => errorMessage);
        }

        throw new Error(errorMessage);
      }

      setSuccess('Tracking saved');
      onSuccess?.({ carrier, trackingNumber });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to save tracking';
      setError(message);
    }
  }

  const rootClass =
    layout === 'stacked'
      ? 'ah-form ah-form--stacked'
      : 'ah-form ah-form--inline';

  return (
    <form>
      <div className={rootClass}>
        <div className="ah-form-row">
          <select
            id={`carrier-${orderId}`}
            className="ah-input"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as Carrier)}
            disabled={isPending}
          >
            {carriers.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="ah-form-row">
          <input
            id={`tracking-${orderId}`}
            className="ah-input"
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="9400… / 1Z… / 7…"
            disabled={isPending}
          />
        </div>

        <div className="ah-form-actions">
          <button
            type="button"
            className="btn"
            disabled={isPending}
            onClick={() => startTransition(submit)}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && (
          <p className="ah-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="ah-success" role="status">
            {success}
          </p>
        )}
      </div>
    </form>
  );
}
