'use client';
import {
  toIdentity,
  useLoginEvent,
  usePostHogIdentity
} from '@/hooks/analytics/use-posthog-identity';
import { useUser } from '@/hooks/use-user';
import { useEffect } from 'react';

export function AnalyticsIdentityBridge() {
  const { user } = useUser();
  const identity = toIdentity(user);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development')
      console.log('[PH] useUser() →', user, 'toIdentity →', identity);
  }, [user, identity]);

  usePostHogIdentity(identity);
  useLoginEvent(identity);
  return null;
}
