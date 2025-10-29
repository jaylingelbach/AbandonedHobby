'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { POSTHOG } from '@/lib/posthog/config';

let initialized = false;

/**
 * Determines whether a rejection reason is an `AbortError` that references PostHog.
 *
 * @param reason - The rejection reason to inspect (for example, the `event.reason` from an `unhandledrejection` handler)
 * @returns `true` if `reason` is an `AbortError` and its message or stack contains either `"posthog"` or the hostname of `POSTHOG.apiHost`, `false` otherwise
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
 * Initializes PostHog analytics for the application and, in development, suppresses unhandled promise rejection events caused by PostHog aborts.
 *
 * When mounted, the component:
 * - In development only: attaches an `unhandledrejection` listener that prevents the default handling of rejections identified as PostHog aborts.
 * - On first run: reads `NEXT_PUBLIC_POSTHOG_KEY` and, if present, calls `posthog.init` with environment-aware hosts and sensible defaults (pageview, pageleave, session recording with masked inputs, and exception capture disabled in development).
 *
 * @returns `null` — the component renders nothing.
 */
export default function PostHogInit() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      const onRejection = (event: PromiseRejectionEvent) => {
        if (isPosthogAbort(event?.reason)) event.preventDefault();
      };
      window.addEventListener('unhandledrejection', onRejection);
      return () =>
        window.removeEventListener('unhandledrejection', onRejection);
    }
  }, []);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    const isDev = process.env.NODE_ENV === 'development';

    posthog.init(key, {
      api_host: isDev ? POSTHOG.apiHost : `/${POSTHOG.proxyPath}`,
      ui_host: POSTHOG.uiHost,
      capture_pageview: true,
      capture_pageleave: true,
      capture_exceptions: process.env.NODE_ENV !== 'development',
      session_recording: { maskAllInputs: true },
      debug: process.env.NODE_ENV === 'development'
    });
  }, []);

  return null;
}