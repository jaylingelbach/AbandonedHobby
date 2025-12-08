import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

/**
 * Exposes the current cart summary and a non-negative badge count together with React Query state and utilities.
 *
 * @returns An object with:
 *  - `cartSummary` — the latest cart summary data or `undefined` if not available;
 *  - `badgeCount` — the cart's total quantity clamped to zero or greater;
 *  - `isLoading` — `true` while the summary is initially loading, `false` otherwise;
 *  - `isError` — `true` if the query is in an error state, `false` otherwise;
 *  - `error` — the query error object when present, otherwise `undefined`;
 *  - `refetch` — a function to manually refetch the cart summary;
 *  - `isFetching` — `true` when a background refetch is in progress, `false` otherwise.
 */
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