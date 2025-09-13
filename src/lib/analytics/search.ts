'use client';

import { capture } from '@/lib/analytics/ph-utils/ph';

const EVENT = 'searchPerformed' as const;

export type SearchPerformedProps = {
  queryLength: number;
  hasFilters: boolean;
  tenantSlug?: string;
  resultCount?: number;
};

export function captureSearchPerformed(props: SearchPerformedProps): void {
  if (props.queryLength <= 0) return; // drop accidental fires
  const sanitized =
    props.resultCount != null && props.resultCount < 0
      ? { ...props, resultCount: 0 }
      : props;
  capture(EVENT, sanitized);
}
