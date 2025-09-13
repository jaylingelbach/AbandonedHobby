'use client';
import posthog from 'posthog-js';

export function capture(name: string, props?: Record<string, any>) {
  try {
    posthog.capture(name, props);
  } catch {
    console.info('unable to PH capture');
  }
}
