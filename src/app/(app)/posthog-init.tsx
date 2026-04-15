'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { POSTHOG } from '@/lib/posthog/config';
import {
  CONSENT_EVENT,
  CONSENT_KEY,
  getConsent,
  type ConsentValue
} from '@/lib/analytics/consent';

let initialized = false;

/**
 * Determine whether an unknown rejection reason is a PostHog-related AbortError.
 *
 * @param reason - The rejection reason to inspect; may be any value.
 * @returns `true` if `reason` is an object with `name === 'AbortError'` and its message or stack contains either "posthog" or the configured PostHog API hostname, `false` otherwise.
 */
function isPosthogAbort(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const name = (reason as { name?: unknown }).name;
  if (name !== 'AbortError') return false;
  const text =
    `${(reason as { message?: unknown }).message ?? ''} ${(reason as { stack?: unknown }).stack ?? ''}`.toLowerCase();
  return (
    text.includes('posthog') || text.includes(new URL(POSTHOG.apiHost).hostname)
  );
}

/**
 * Initialize PostHog analytics once using the provided consent to determine capture and persistence settings.
 *
 * If PostHog is already initialized or the `NEXT_PUBLIC_POSTHOG_KEY` env var is not set, this function is a no-op.
 *
 * @param consent - The current consent value; `'necessary'` enables minimal in-memory-only collection and disables session recording, while other accepted values enable persistent storage and fuller capture.
 */
function initPosthog(consent: ConsentValue): void {
  if (initialized) return;
  initialized = true;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const necessary = consent === 'necessary';

  posthog.init(key, {
    api_host: isDev() ? POSTHOG.apiHost : `/${POSTHOG.proxyPath}`,
    ui_host: POSTHOG.uiHost,
    capture_pageview: true,
    capture_pageleave: !necessary,
    capture_exceptions: !isDev(),
    persistence: necessary ? 'memory' : 'localStorage+cookie',
    session_recording: necessary ? { sampleRate: 0 } : { maskAllInputs: true },
    debug: isDev()
  });
}

/**
 * React component that initializes and updates PostHog according to stored consent and suppresses PostHog-related unhandled promise rejections during development.
 *
 * Sets up two effects:
 * - In development, registers an `unhandledrejection` handler that prevents default behavior for rejections identified as PostHog aborts.
 * - On mount, reads current consent and initializes PostHog when consent is `accepted` or `necessary`; listens for `CONSENT_EVENT` to update runtime PostHog configuration or opt in/out of capturing; listens for cross-tab `storage` events to propagate consent changes.
 *
 * The component renders nothing.
 */
export default function PostHogInit() {
  useEffect(() => {
    if (isDev() && typeof window !== 'undefined') {
      const onRejection = (event: PromiseRejectionEvent) => {
        if (isPosthogAbort(event?.reason)) event.preventDefault();
      };
      window.addEventListener('unhandledrejection', onRejection);
      return () =>
        window.removeEventListener('unhandledrejection', onRejection);
    }
  }, []);

  useEffect(() => {
    const consent = getConsent();
    if (consent === 'accepted' || consent === 'necessary') {
      initPosthog(consent);
    }

    const onConsentChange = (event: Event) => {
      const value = (event as CustomEvent<ConsentValue>).detail;
      const necessary = value === 'necessary';

      if (value === 'accepted' || value === 'necessary') {
        if (initialized) {
          posthog.set_config({
            persistence: necessary ? 'memory' : 'localStorage+cookie',
            capture_pageleave: !necessary,
            session_recording: necessary
              ? { sampleRate: 0 }
              : { maskAllInputs: true }
          });
          posthog.opt_in_capturing();
        } else {
          initPosthog(value);
        }
      } else if (value === 'declined' && initialized) {
        posthog.opt_out_capturing();
      }
    };

    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== CONSENT_KEY || !event.newValue) return;
      onConsentChange(
        new CustomEvent(CONSENT_EVENT, { detail: event.newValue as ConsentValue })
      );
    };

    window.addEventListener(CONSENT_EVENT, onConsentChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsentChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  return null;
}

/**
 * Detects whether the current runtime environment is development.
 *
 * @returns `true` if `process.env.NODE_ENV` is `'development'`, `false` otherwise.
 */
function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}
