'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

let initialized = false;

export default function PostHogInit() {
  useEffect(() => {
    // Dev-only: swallow AbortError from PostHog network calls (HMR/route changes)
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      const onRejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason as unknown;
        const name = (reason as { name?: string })?.name;
        // AbortError messages vary by browser; checking name is the safest
        if (name === 'AbortError') {
          // Optional: further narrow to PostHog by inspecting stack/message/url if present
          event.preventDefault();
        }
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

    const isDev =
      typeof window !== 'undefined' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

    posthog.init(key, {
      api_host: isDev ? 'https://us.i.posthog.com' : '/_phx_a1b2c3',
      ui_host: 'https://us.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      capture_exceptions: true,
      session_recording: { maskAllInputs: false },
      debug: process.env.NODE_ENV === 'development'
    });
  }, []);

  return null;
}
