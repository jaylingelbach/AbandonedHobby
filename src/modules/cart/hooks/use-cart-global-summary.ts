import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

export function useCartGlobalSummary() {
  const trpc = useTRPC();
  const summaryOptions = trpc.cart.getSummaryForIdentity.queryOptions();
  const query = useQuery(summaryOptions);
  const cartSummary = query.data;
  const badgeCount = Math.max(query.data?.totalQuantity ?? 0, 0);

  return {
    cartSummary,
    badgeCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching
  };
}
