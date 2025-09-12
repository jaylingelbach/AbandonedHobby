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

    // Fallback to console in dev
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[analytics]', event, props);
    }
  } catch {
    // swallow analytics errors
  }
}
