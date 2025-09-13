'use client';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

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
