import posthog from 'posthog-js';

export type SearchPerformedProps = {
  queryLength: number;
  hasFilters: boolean;
  tenantSlug?: string;
  resultCount?: number;
};

export function captureSearchPerformed(props: SearchPerformedProps): void {
  if (typeof window === 'undefined') return; // client-only
  posthog.capture('searchPerformed', props);
}
