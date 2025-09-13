'use client';
import posthog from 'posthog-js';

export function capture(name: string, props?: Record<string, unknown>) {
  try {
    if (typeof window === 'undefined') return;
    posthog.capture(name, props);
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.info('unable to PH capture');
    }
  }
}
