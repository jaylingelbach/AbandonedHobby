'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState } from 'react';
import { z } from 'zod';

import { buildTrackingUrl } from '@/lib/utils';

import { carrierLabels, carriers, type Carrier } from '@/constants';

/**
 * Normalize a tracking number for consistent storage and comparison.
 *
 * @returns The tracking number with surrounding whitespace removed, internal spaces and dash-like characters stripped, and letters converted to uppercase.
 */
function normalizeTracking(raw: string): string {
  return raw
    .trim()
    .replace(/[\s\u2010-\u2015-]+/g, '')
    .toUpperCase();
}

/**
 * Type guard that asserts a value is a valid Carrier.
 *
 * @param value - The value to test
 * @returns `true` if `value` is one of the known carriers, `false` otherwise.
 */
function isCarrier(value: unknown): value is Carrier {
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
  const normalized = normalizeTracking(raw);
  return patterns[carrier].some((regex) => regex.test(normalized));
}

/** Zod schema with carrier-aware refinement. */
const FormSchema = z
  .object({
    carrier: z.enum(carriers),
    trackingNumber: z.string().trim().min(1, 'Tracking number is required')
  })
  .superRefine((data, context) => {
    if (!isLikelyValidTracking(data.carrier, data.trackingNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackingNumber'],
        message:
          data.carrier === 'usps'
            ? 'Expected 20/22/26/30/34 digits (IMpb) or an S10 code like EC123456789US.'
            : data.carrier === 'ups'
              ? 'Expected UPS format: 1Z + 16 letters/digits (e.g., 1Z999AA10123456784).'
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
 * Render an inline form to view, edit, and save a shipment carrier and tracking number for an order.
 *
 * The component normalizes the tracking input and validates it against carrier-specific heuristics,
 * provides a compact view with a carrier-specific tracking link when available, and allows saving
 * or removing the tracking value. On save/remove the component updates the order via a PATCH to
 * `${apiBase}/orders/:orderId`, displays inline success or error feedback, and optionally triggers
 * a router refresh when the operation succeeds.
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show a compact summary when we already have tracking; otherwise show inputs
  const [viewMode, setViewMode] = useState<'view' | 'edit'>(
    initialTracking ? 'view' : 'edit'
  );

  // Abort in-flight requests on unmount and between submits/removals
  const currentRequestAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    return () => currentRequestAbortRef.current?.abort();
  }, []);

  /**
   * Validate and submit a tracking number for the current order, updating component state and optionally refreshing the page.
   *
   * Normalizes the provided tracking value, validates it against the form schema for the selected carrier, aborts any in-flight request, and sends a PATCH to update the order's shipment (carrier and normalized tracking number). On success, updates local state (carrier, trackingNumber, viewMode) and either calls the router refresh or sets a success message. On error, sets an error message; abort errors are ignored.
   *
   * @param nextValues - Object containing the selected `carrier` and the raw `tracking` string (the tracking string will be normalized before validation and submission)
   */
  async function submit(nextValues: { carrier: Carrier; tracking: string }) {
    setErrorMessage(null);
    setSuccessMessage(null);

    // cancel any in-flight request
    currentRequestAbortRef.current?.abort();
    currentRequestAbortRef.current = new AbortController();
    const { signal } = currentRequestAbortRef.current;

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
          }),
          signal
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let message = `Failed with ${response.status}`;

        if (contentType.toLowerCase().includes('json')) {
          try {
            const jsonBody: unknown = await response.json();
            const asRecord = jsonBody as { message?: string; error?: string };
            message = asRecord.message || asRecord.error || message;
          } catch (_jsonParseError: unknown) {
            // ignore parse failure; keep fallback message
          }
        } else if (contentType.startsWith('text/')) {
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
      if ((errorObject as { name?: string } | null)?.name === 'AbortError') {
        // request was aborted; ignore
        return;
      }
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : 'Failed to save tracking';
      console.error('Failed to save tracking:', errorObject);
      setErrorMessage(message);
    }
  }

  /**
   * Clears the order's shipment tracking on the server and updates the component state accordingly.
   *
   * Sends a request to remove the tracking number for the current order, aborting any in-flight request first.
   * On success, clears the local tracking number, switches the form to edit mode, and either refreshes the router
   * (when `refreshOnSuccess` is true) or shows a "Tracking removed" success message. On failure, sets an
   * error message derived from the server response. If the request is aborted, the function returns silently.
   */
  async function removeTracking() {
    setErrorMessage(null);
    setSuccessMessage(null);

    // cancel any in-flight request
    currentRequestAbortRef.current?.abort();
    currentRequestAbortRef.current = new AbortController();
    const { signal } = currentRequestAbortRef.current;

    try {
      const response = await fetch(
        `${apiBase}/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            shipment: { trackingNumber: '' } // server hook will clear URL and shippedAt
          }),
          signal
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let message = `Failed with ${response.status}`;

        if (contentType.toLowerCase().includes('json')) {
          try {
            const body: unknown = await response.json();
            const record = body as { message?: string; error?: string };
            message = record.message || record.error || message;
          } catch (_jsonErr: unknown) {
            // ignore
          }
        } else if (contentType.startsWith('text/')) {
          try {
            const textBody = await response.text();
            if (textBody) message = textBody;
          } catch (_readErr: unknown) {
            // ignore
          }
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
      if ((errorObject as { name?: string } | null)?.name === 'AbortError') {
        // request was aborted; ignore
        return;
      }
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
            disabled={isSubmitting}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={async () => {
              const confirmed = window.confirm(
                'Remove tracking number? This will revert the order to “Unfulfilled”.'
              );
              if (!confirmed || isSubmitting) return;
              setIsSubmitting(true);
              try {
                await removeTracking();
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
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
        <label className="sr-only" htmlFor={`carrier-${orderId}`}>
          Carrier
        </label>
        <select
          id={`carrier-${orderId}`}
          className="ah-input"
          value={carrier}
          onChange={(event) => {
            const selectedValue = event.currentTarget.value;
            if (isCarrier(selectedValue)) {
              setCarrier(selectedValue);
              setErrorMessage(null);
            } else {
              setErrorMessage('Invalid carrier selection.');
            }
          }}
          disabled={isSubmitting}
        >
          {carriers.map((carrierOption) => (
            <option key={carrierOption} value={carrierOption}>
              {carrierLabels[carrierOption]}
            </option>
          ))}
        </select>
      </div>

      <div className="ah-form-row">
        <label className="sr-only" htmlFor={`tracking-${orderId}`}>
          Tracking number
        </label>
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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
          onClick={async () => {
            if (isSubmitting) return;
            setIsSubmitting(true);
            try {
              await submit({ carrier, tracking: trackingNumber });
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? 'Saving…' : 'Save'}
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
            disabled={isSubmitting}
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
