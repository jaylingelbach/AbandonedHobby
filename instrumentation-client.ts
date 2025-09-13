import posthog from 'posthog-js';

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (typeof window !== 'undefined' && key) {
  posthog.init(key, {
    api_host: '/_phx_a1b2c3',
    ui_host: 'https://us.posthog.com',
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false
    },
    debug: process.env.NODE_ENV === 'development'
  });
} else if (process.env.NODE_ENV === 'development') {
  console.warn(
    'PostHog not initialized: missing NEXT_PUBLIC_POSTHOG_KEY or non-browser environment'
  );
}

export default posthog;
