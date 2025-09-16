// // app/components/PostHogInit.tsx
// 'use client';

// import { useEffect } from 'react';
// import posthog from 'posthog-js';

// declare global {
//   interface Window {
//     posthog: typeof posthog;
//   }
// }

// let initialized = false;

// export default function PostHogInit() {
//   useEffect(() => {
//     if (initialized) return;
//     initialized = true;

//     const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
//     if (!key) {
//       if (process.env.NODE_ENV !== 'production') {
//         console.warn(
//           'PostHog key missing (NEXT_PUBLIC_POSTHOG_KEY). Skipping init.'
//         );
//       }
//       // still expose the library so console checks don’t crash
//       if (typeof window !== 'undefined') {
//         window.posthog = posthog;
//       }
//       return;
//     }

//     posthog.init(key, {
//       api_host: '/_phx_a1b2c3',
//       ui_host: 'https://us.posthog.com',
//       capture_exceptions: true,
//       debug: process.env.NODE_ENV === 'development'
//     });

//     // Expose for console debugging in ALL envs
//     if (typeof window !== 'undefined') {
//       window.posthog = posthog;
//       // quick sanity check
//       console.log('[PH] window.posthog set?', !!window.posthog);
//     }
//   }, []);

//   return null;
// }

// app/posthog-init.tsx (CLIENT)
'use client';

import { useEffect } from 'react';
import posthog, { PostHog } from 'posthog-js';

declare global {
  interface Window {
    posthog: PostHog;
  }
}

let initialized = false;

declare global {
  interface Window {
    posthog: typeof posthog;
  }
}

export default function PostHogInit() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
    const env = process.env.NODE_ENV;

    // Always log once so we can see this in prod
    console.log('[PH] init start', { env, keyPresent: Boolean(key) });

    if (!key) {
      console.warn('[PH] missing NEXT_PUBLIC_POSTHOG_KEY');
      return;
    }

    posthog.init(key, {
      api_host: '/_phx_a1b2c3', // first-party proxy path
      ui_host: 'https://us.posthog.com',
      capture_exceptions: true,
      debug: true // enable for prod debugging; turn off later
    });

    // Expose for console tests in prod while debugging
    if (typeof window !== 'undefined') {
      window.posthog = posthog;
      posthog.capture('ph_boot', { env });
      console.log('[PH] init done; posthog attached to window');
    }
  }, []);

  return null;
}
