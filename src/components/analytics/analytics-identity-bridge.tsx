'use client';
import { useEffect } from 'react';

import {
  toIdentity,
  useLoginEvent,
  usePostHogIdentity
} from '@/hooks/analytics/use-posthog-identity';
import { useUser } from '@/hooks/use-user';

export function AnalyticsIdentityBridge() {
  const { user } = useUser();
  const identity = toIdentity(user);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === '1')
      console.log('[PH] useUser() →', user, 'toIdentity →', identity);
  }, [user, identity]);

  usePostHogIdentity(identity);
  useLoginEvent(identity);
  return null;
}
