'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState, useTransition } from 'react';
import { z } from 'zod';

const carriers = ['usps', 'ups', 'fedex', 'other'] as const;
type Carrier = (typeof carriers)[number];

/** Normalize: trim, collapse spaces/dashes, uppercase. */
function normalizeTracking(raw: string): string {
  return raw
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase();
}

/** Heuristic regexes for common formats. */
const patterns: Record<Carrier, RegExp[]> = {
  usps: [
    // 20–22 digits (most USPS domestic)
    /^\d{20,22}$/,
    // UPU S10 format w/ US suffix (e.g., "EC123456789US")
    /^[A-Z]{2}\d{9}US$/
  ],
  ups: [
    // 1Z + 16 A–Z0–9 (total 18 chars)
    /^1Z[0-9A-Z]{16}$/
  ],
  fedex: [
    // 12, 15, 20, or 22 digits (common FedEx lengths)
    /^(?:\d{12}|\d{15}|\d{20}|\d{22})$/,
    // Door tag (e.g., DT123456789012)
    /^DT\d{12,14}$/
  ],
  other: [
    // fallback: at least 6 visible characters after normalization
    /^.{6,}$/
  ]
};

function isLikelyValidTracking(carrier: Carrier, raw: string): boolean {
  const tn = normalizeTracking(raw);
  return patterns[carrier].some((re) => re.test(tn));
}

/** Zod schema with carrier-aware refinement. */
const FormSchema = z
  .object({
    carrier: z.enum(carriers),
    trackingNumber: z.string().trim().min(1, 'Tracking number is required')
  })
  .superRefine((data, ctx) => {
    if (!isLikelyValidTracking(data.carrier, data.trackingNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackingNumber'],
        message:
          data.carrier === 'usps'
            ? 'Expected 20–22 digits (e.g., 9400…) or format like EC123456789US.'
            : data.carrier === 'ups'
              ? 'Expected UPS format: 1Z + 16 letters/digits (e.g., 1Z… ).'
              : data.carrier === 'fedex'
                ? 'Expected 12/15/20/22 digits or a door tag like DT123456789012.'
                : 'Tracking looks too short — enter at least 6 characters.'
      });
    }
  });

type InlineTrackingFormProps = {
  orderId: string;
  initialCarrier?: Carrier;
  initialTracking?: string;
  apiBase?: string; // default '/api'
  layout?: 'inline' | 'stacked';
  refreshOnSuccess?: boolean; // default true
};

export function InlineTrackingForm(props: InlineTrackingFormProps) {
  const {
    orderId,
    initialCarrier = 'usps',
    initialTracking = '',
    apiBase = '/api',
    layout = 'inline',
    refreshOnSuccess = true
  } = props;

  const router = useRouter();
  const [carrier, setCarrier] = useState<Carrier>(initialCarrier);
  const [trackingNumber, setTrackingNumber] = useState<string>(initialTracking);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    setSuccess(null);

    // Normalize before validation & submit
    const normalized = normalizeTracking(trackingNumber);

    const parsed = FormSchema.safeParse({
      carrier,
      trackingNumber: normalized
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    try {
      const res = await fetch(
        `${apiBase}/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            shipment: { carrier, trackingNumber: normalized }
          })
        }
      );

      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        let msg = `Failed with ${res.status}`;
        if (ct.includes('application/json')) {
          try {
            const j = await res.json();
            msg = j.message || j.error || msg;
          } catch (error) {
            console.warn('Failed to parse JSON error:', error);
          }
        } else if (ct.includes('text/plain')) {
          try {
            msg = await res.text();
          } catch (error) {
            console.warn('Failed to read text error:', error);
          }
        }
        throw new Error(msg);
      }

      setTrackingNumber(normalized); // reflect normalization in UI
      setSuccess('Tracking saved');

      if (refreshOnSuccess) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to save tracking:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to save tracking'
      );
    }
  }

  const rootClass =
    layout === 'stacked'
      ? 'ah-form ah-form--stacked'
      : 'ah-form ah-form--inline';

  return (
    <div className={rootClass}>
      <div className="ah-form-row">
        <select
          id={`carrier-${orderId}`}
          className="ah-input"
          value={carrier}
          onChange={(e) => {
            setCarrier(e.target.value as Carrier);
            setError(null);
          }}
          disabled={isPending}
          aria-label="Carrier"
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
          onBlur={(e) => setTrackingNumber(normalizeTracking(e.target.value))}
          placeholder="9400… / 1Z… / DT…"
          disabled={isPending}
          aria-label="Tracking number"
          aria-invalid={Boolean(error) || undefined}
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
  );
}
