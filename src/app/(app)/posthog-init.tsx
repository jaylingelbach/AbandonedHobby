'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { POSTHOG } from '@/lib/posthog/config';

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
