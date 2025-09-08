'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import type { OnboardingStep, UIState } from './types';

export function useOnboardingBanner() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const query = useQuery({
    ...trpc.users.me.queryOptions(),
    staleTime: 5 * 60_000, // keep ‘fresh’ for 5 minutes
    refetchOnWindowFocus: false, // ← stop refetching when tab is focused
    refetchOnReconnect: false, // don’t refetch after reconnection
    refetchOnMount: false, // if cached, don’t refetch on mount
    gcTime: 30 * 60_000 // keep cache 30m after unmount
  });

  const dismiss = useMutation(
    trpc.users.dismissOnboardingBanner.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries(trpc.users.me.queryFilter());
      }
    })
  );

  const data = query.data;
  const step = data?.onboarding.step as OnboardingStep | undefined;

  const uiState: UIState | undefined = data?.user.uiState;

  const shouldShow =
    !!data &&
    step !== undefined &&
    step !== 'dashboard' &&
    uiState?.hideOnboardingBanner !== true && // permanent hide
    uiState?.onboardingDismissedStep !== step;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    shouldShow,
    label: data?.onboarding.label,
    step,
    next: data?.onboarding.next,
    dismissOnce: () => {
      if (!step || dismiss.isPending) return;
      dismiss.mutate({ step });
    },
    dismissForever: () => {
      if (!step || dismiss.isPending) return;
      dismiss.mutate({ step, forever: true });
    },
    isDismissing: dismiss.isPending
  };
}
