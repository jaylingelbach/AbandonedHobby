'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

let initialized = false;

export default function PostHogInit() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'PostHog key missing (NEXT_PUBLIC_POSTHOG_KEY). Skipping init.'
        );
      }
      return;
    }
    posthog.init(key, {
      api_host: '/_phx_a1b2c3',
      ui_host: 'https://us.posthog.com',
      defaults: '2025-05-24',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === 'development'
    });
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      (window as unknown as { posthog: typeof posthog }).posthog = posthog;
    }
  }, []);

  return null;
}
