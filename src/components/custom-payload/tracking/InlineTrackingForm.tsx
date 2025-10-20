'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState, useTransition } from 'react';
import { z } from 'zod';

const carriers = ['usps', 'ups', 'fedex', 'other'] as const;
type Carrier = (typeof carriers)[number];
const carrierLabels: Record<Carrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  other: 'Other'
};

/**
 * Normalize a tracking string by trimming whitespace, removing spaces and dash-like characters, and converting to uppercase.
 *
 * @returns The normalized tracking string.
 */
function normalizeTracking(raw: string): string {
  return raw
    .trim()
    .replace(/[\s\u2010-\u2015-]+/g, '')
    .toUpperCase();
}

/** Heuristic regexes for common formats. */
const patterns: Record<Carrier, RegExp[]> = {
  usps: [
    // IMpb / domestic numeric labels — common lengths:
    // 20, 22, 26, 30, 34 digits
    /^(?:\d{20}|\d{22}|\d{26}|\d{30}|\d{34})$/,

    // UPU S10: 2 letters + 9 digits + 2 letters (country code),
    // e.g., EC123456789US, RX123456789DE, etc.
    /^[A-Z]{2}\d{9}[A-Z]{2}$/
  ],
  ups: [
    // 1Z + 16 alphanumeric (total 18)
    /^1Z[0-9A-Z]{16}$/
  ],
  fedex: [
    // 12, 15, 20, or 22 digits
    /^(?:\d{12}|\d{15}|\d{20}|\d{22})$/,
    // Door tag (e.g., DT123456789012)
    /^DT\d{12,14}$/
  ],
  other: [
    // Fallback: at least 6 visible characters after normalization
    /^.{6,}$/
  ]
};

/**
 * Determines whether a tracking number matches the expected formats for a given carrier.
 *
 * @param carrier - The carrier to validate against.
 * @param raw - The raw tracking input; it will be normalized before testing.
 * @returns `true` if the normalized tracking number matches any pattern for `carrier`, `false` otherwise.
 */
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
            ? 'Expected 20/22/26/30/34 digits (IMpb) or an S10 code like EC123456789US.'
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

/**
 * Inline form for selecting a carrier and saving a shipment tracking number for an order.
 *
 * Normalizes and validates the tracking number against carrier-specific heuristics, submits a PATCH
 * to `${apiBase}/orders/:orderId` with `{ shipment: { carrier, trackingNumber } }`, and displays
 * inline success or error feedback. On successful save it updates the displayed tracking value to
 * the normalized form and optionally triggers a router refresh.
 *
 * @param props - Component props
 * @param props.orderId - Order identifier used in the API request and element IDs
 * @param props.initialCarrier - Initial carrier selection; defaults to `'usps'`
 * @param props.initialTracking - Initial tracking input value; defaults to `''`
 * @param props.apiBase - Base URL for the API request; defaults to `'/api'`
 * @param props.layout - Layout mode, either `'inline'` or `'stacked'`; defaults to `'inline'`
 * @param props.refreshOnSuccess - When true, calls router.refresh() after a successful save; defaults to `true`
 * @returns The rendered React element for the inline tracking form
 */
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
      } else {
        setSuccess('Tracking saved');
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
          {carriers.map((carrier) => (
            <option key={carrier} value={carrier}>
              {carrierLabels[carrier]}
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
          aria-describedby={error ? `tracking-error-${orderId}` : undefined}
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
        <p className="ah-error" role="alert" id={`tracking-error-${orderId}`}>
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