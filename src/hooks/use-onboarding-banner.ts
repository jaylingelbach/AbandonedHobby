'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTRPC } from '@/trpc/client';

import type { OnboardingStep, UIState } from './types';


/**
 * React hook that determines whether to show an onboarding banner and provides dismissal actions.
 *
 * The hook reads current user and onboarding state via TRPC/React Query, tracks a per-user/per-step
 * session dismissal flag (sessionStorage) and exposes a mutation to persist a "don't show again"
 * preference on the server. Visibility is suppressed when the onboarding step is missing or `dashboard`,
 * when the user's UI state has `hideOnboardingBanner: true`, or when the banner was dismissed for the
 * current step during this session.
 *
 * @returns An object with:
 * - `isLoading` — query loading flag.
 * - `isError` — query error flag.
 * - `error` — query error (if any).
 * - `shouldShow` — true when the banner should be shown for the current user/step.
 * - `label` — onboarding label from the server (if present).
 * - `step` — current onboarding step (or `undefined`).
 * - `next` — next onboarding step (if present).
 * - `dismissOnce` — function that hides the banner for the current session (stores a per-user/per-step key in sessionStorage).
 * - `dismissForever` — function that persists a "don't show again" preference via a server mutation (`{ step, forever: true }`).
 * - `isDismissing` — true while the persistent-dismiss mutation is in progress.
 * - `dismissError` — mutation error (as an `Error`), if any.
 */
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
        const message =
          error instanceof Error
            ? error.message
            : 'Could not update your preference.';
        toast.error(message);
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

  // initialize dismissedThisStep from sessionStorage in a lazy initializer to avoid a setState on mount.
  const [dismissedThisStep, setDismissedThisStep] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(sessionKey) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissedThisStep(sessionStorage.getItem(sessionKey) === '1');
    } catch {
      setDismissedThisStep(false);
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
    dismissError:
      dismissPersisted.error instanceof Error
        ? dismissPersisted.error
        : undefined
  };
}
