'use client';

import { capture } from '@/lib/analytics/ph-utils/ph';

export type SearchPerformedProps = {
  queryLength: number;
  hasFilters: boolean;
  tenantSlug?: string;
  resultCount?: number;
};

export function captureSearchPerformed(props: SearchPerformedProps): void {
  capture('searchPerformed', props);
}
