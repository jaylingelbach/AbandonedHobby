'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import type { OnboardingStep, UIState } from './types';
import { toast } from 'sonner';

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
      },
      onError: async (error) => {
        toast.error(error.message);
      }
    })
  );

  const data = query.data;
  const step = data?.onboarding.step as OnboardingStep | undefined;
  const userId = data?.user.id ?? 'anon';
  const uiState: UIState | undefined = data?.user.uiState;

  // Per-user + per-step session key (naturally resets when user/step change)
  const sessionKey = useMemo(
    () => `ah:onboarding:dismissed:${userId}:${step ?? ''}`,
    [userId, step]
  );

  const [dismissedThisStep, setDismissedThisStep] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissedThisStep(sessionStorage.getItem(sessionKey) === '1');
    }
  }, [sessionKey]);

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
      setDismissedThisStep(true);
    },
    // permanent (persisted) dismissal
    dismissForever: () => {
      if (!step || dismissPersisted.isPending) return;
      dismissPersisted.mutate({ step, forever: true });
    },

    // mutation state
    isDismissing: dismissPersisted.isPending,
    dismissError: dismissPersisted.error
  };
}
