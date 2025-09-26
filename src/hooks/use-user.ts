'use client';
import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/trpc/client';

export function useUser() {
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery(trpc.auth.session.queryOptions());

  return {
    user: data?.user ?? null,
    isLoading,
    error,
    isLoggedIn: !!data?.user
  };
}
