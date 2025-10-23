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

// Prevent DOM manipulation from making it through to being accepted at compile time. (Still validates client side at submit by FormSchema: carrier: z.enum(carriers))
function isCarrier(value: unknown) {
  return (
    typeof value === 'string' && (carriers as readonly string[]).includes(value)
  );
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Show a compact summary when we already have tracking; otherwise show inputs
  const [viewMode, setViewMode] = useState<'view' | 'edit'>(
    initialTracking ? 'view' : 'edit'
  );

  function buildTrackingUrl(
    selectedCarrier: Carrier,
    normalizedTracking: string
  ): string | undefined {
    if (!normalizedTracking) return undefined;
    if (selectedCarrier === 'usps') {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(normalizedTracking)}`;
    }
    if (selectedCarrier === 'ups') {
      return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(normalizedTracking)}`;
    }
    if (selectedCarrier === 'fedex') {
      return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(normalizedTracking)}`;
    }
    return undefined;
  }

  async function submit(nextValues: { carrier: Carrier; tracking: string }) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedTracking = normalizeTracking(nextValues.tracking);

    const parsed = FormSchema.safeParse({
      carrier: nextValues.carrier,
      trackingNumber: normalizedTracking
    });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid input';
      setErrorMessage(firstIssue);
      return;
    }

    try {
      const response = await fetch(
        `${apiBase}/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            shipment: {
              carrier: nextValues.carrier,
              trackingNumber: normalizedTracking
            }
          })
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let message = `Failed with ${response.status}`;

        if (contentType.includes('application/json')) {
          try {
            const jsonBody: unknown = await response.json();
            const asRecord = jsonBody as { message?: string; error?: string };
            message = asRecord.message || asRecord.error || message;
          } catch (_jsonParseError: unknown) {
            // ignore parse failure; keep fallback message
          }
        } else if (contentType.includes('text/plain')) {
          try {
            const textBody = await response.text();
            message = textBody || message;
          } catch (_textReadError: unknown) {
            // ignore read failure; keep fallback message
          }
        }

        throw new Error(message);
      }

      // reflect normalization in UI and go to view mode
      setCarrier(nextValues.carrier);
      setTrackingNumber(normalizedTracking);
      setViewMode('view');

      if (refreshOnSuccess) {
        router.refresh();
      } else {
        setSuccessMessage('Tracking saved');
      }
    } catch (errorObject: unknown) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : 'Failed to save tracking';
      console.error('Failed to save tracking:', errorObject);
      setErrorMessage(message);
    }
  }

  async function removeTracking() {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${apiBase}/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            shipment: { trackingNumber: '' } // server hook will clear URL and shippedAt
          })
        }
      );

      if (!response.ok) {
        let message = `Failed with ${response.status}`;
        try {
          const textBody = await response.text();
          if (textBody) message = textBody;
        } catch (_readError: unknown) {
          // ignore
        }
        throw new Error(message);
      }

      setTrackingNumber('');
      setViewMode('edit');

      if (refreshOnSuccess) {
        router.refresh();
      } else {
        setSuccessMessage('Tracking removed');
      }
    } catch (errorObject: unknown) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : 'Failed to remove tracking';
      console.error('Failed to remove tracking:', errorObject);
      setErrorMessage(message);
    }
  }

  const rootClassName =
    layout === 'stacked'
      ? 'ah-form ah-form--stacked'
      : 'ah-form ah-form--inline';

  if (viewMode === 'view' && trackingNumber) {
    const trackingUrl = buildTrackingUrl(carrier, trackingNumber);

    return (
      <div className={rootClassName} aria-live="polite">
        <div className="ah-form-row">
          <div className="ah-summary">
            <span className="ah-summary-label">Carrier:</span>{' '}
            <strong>{carrierLabels[carrier]}</strong>
          </div>
        </div>

        <div className="ah-form-row">
          <div className="ah-summary">
            <span className="ah-summary-label">Tracking #:</span>{' '}
            <code>{trackingNumber}</code>{' '}
            {trackingUrl ? (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ah-link"
              >
                Track
              </a>
            ) : null}
          </div>
        </div>

        <div className="ah-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setViewMode('edit')}
            disabled={isPending}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              const confirmed = window.confirm(
                'Remove tracking number? This will revert the order to “Unfulfilled”.'
              );
              if (confirmed) startTransition(removeTracking);
            }}
            disabled={isPending}
          >
            Remove
          </button>
        </div>

        {errorMessage && (
          <p className="ah-error" role="alert" id={`tracking-error-${orderId}`}>
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="ah-success" role="status">
            {successMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className="ah-form-row">
        <select
          id={`carrier-${orderId}`}
          className="ah-input"
          value={carrier}
          onChange={(event) => {
            setCarrier(event.target.value as Carrier);
            setErrorMessage(null);
          }}
          disabled={isPending}
          aria-label="Carrier"
        >
          {carriers.map((carrierOption) => (
            <option key={carrierOption} value={carrierOption}>
              {carrierLabels[carrierOption]}
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
          onChange={(event) => setTrackingNumber(event.target.value)}
          onBlur={(event) =>
            setTrackingNumber(normalizeTracking(event.target.value))
          }
          placeholder="9400… / 1Z… / DT…"
          disabled={isPending}
          aria-label="Tracking number"
          aria-invalid={Boolean(errorMessage) || undefined}
          aria-describedby={
            errorMessage ? `tracking-error-${orderId}` : undefined
          }
        />
      </div>

      <div className="ah-form-actions">
        <button
          type="button"
          className="btn"
          disabled={isPending}
          onClick={() =>
            startTransition(() => submit({ carrier, tracking: trackingNumber }))
          }
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>

        {initialTracking && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setCarrier(initialCarrier);
              setTrackingNumber(initialTracking);
              setErrorMessage(null);
              setSuccessMessage(null);
              setViewMode('view');
            }}
            disabled={isPending}
          >
            Cancel
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="ah-error" role="alert" id={`tracking-error-${orderId}`}>
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="ah-success" role="status">
          {successMessage}
        </p>
      )}
    </div>
  );
}
