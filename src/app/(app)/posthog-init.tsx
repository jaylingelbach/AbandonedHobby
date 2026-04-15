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

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}
