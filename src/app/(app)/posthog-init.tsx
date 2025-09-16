'use client';

import { useEffect } from 'react';
import posthog, { PostHog } from 'posthog-js';

declare global {
  interface Window {
    posthog: PostHog;
  }
}

let initialized = false;

export default function PostHogInit() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
    const env = process.env.NODE_ENV;

    // Always log once so we can see this in prod
    // console.log('[PH] init start', { env, keyPresent: Boolean(key) });

    if (!key) {
      console.warn('[PH] missing NEXT_PUBLIC_POSTHOG_KEY');
      return;
    }

    posthog.init(key, {
      api_host: '/_phx_a1b2c3', // first-party proxy path
      ui_host: 'https://us.posthog.com',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === 'development'
    });

    posthog.register({
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
    });

    // Expose for console tests in prod while debugging
    // if (typeof window !== 'undefined') {
    //   window.posthog = posthog;
    //   posthog.capture('ph_boot', { env });
    //   console.log('[PH] init done; posthog attached to window');
    // }
  }, []);

  return null;
}
