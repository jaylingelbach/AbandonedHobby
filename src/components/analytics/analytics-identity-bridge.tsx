'use client';
import {
  toIdentity,
  usePostHogIdentity
} from '@/hooks/analytics/use-posthog-identity';
import { useUser } from '@/hooks/use-user';

export function AnalyticsIdentityBridge() {
  const { user } = useUser();
  const identity = toIdentity(user);
  usePostHogIdentity(identity);
  return null;
}
