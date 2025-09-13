type Props = Record<string, unknown>;

export function track(event: string, props?: Props): void {
  try {
    if (typeof window === 'undefined') return;

    const p = props ?? {};
    const w = window as unknown as {
      analytics?: { track?: (e: string, p?: Props) => void };
      posthog?: { capture?: (e: string, p?: Props) => void };
    };

    // PostHog
    if (w.posthog?.capture) return void w.posthog.capture(event, p);

    // Segment-style fallback
    if (w.analytics?.track) return void w.analytics.track(event, p);

    // Fallback to console in dev
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[analytics]', event, p);
    }
  } catch {
    // swallow analytics errors
  }
}
