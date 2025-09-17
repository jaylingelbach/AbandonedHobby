// use-onboarding-banner.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import type { OnboardingStep, UIState } from './types';

export function useOnboardingBanner() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const query = useQuery({
    ...trpc.users.me.queryOptions(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    gcTime: 30 * 60_000
  });

  const dismissPersisted = useMutation(
    trpc.users.dismissOnboardingBanner.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries(trpc.users.me.queryFilter());
      }
    })
  );

  const data = query.data;
  const step = data?.onboarding.step as OnboardingStep | undefined;
  const userId = data?.user.id ?? 'anon';
  const uiState: UIState | undefined = data?.user.uiState;

  // Per-user + per-step session key (so it naturally resets when user/step changes)
  const sessionKey = `ah:onboarding:dismissed:${userId}:${step ?? ''}`;
  const dismissedThisStep =
    typeof window !== 'undefined' && sessionStorage.getItem(sessionKey) === '1';

  const shouldShow =
    !!data &&
    step !== undefined &&
    step !== 'dashboard' &&
    uiState?.hideOnboardingBanner !== true && // "Don't show again" is persisted
    !dismissedThisStep; // one-time dismiss is session-only

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    shouldShow,
    label: data?.onboarding.label,
    step,
    next: data?.onboarding.next,
    // one-time (session) dismissal
    dismissOnce: () => {
      if (!step) return;
      if (typeof window !== 'undefined')
        sessionStorage.setItem(sessionKey, '1');
    },
    // permanent (persisted) dismissal
    dismissForever: () => {
      if (!step || dismissPersisted.isPending) return;
      dismissPersisted.mutate({ step, forever: true });
    },
    isDismissing: dismissPersisted.isPending
  };
}
