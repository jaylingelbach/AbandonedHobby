import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

export function useServerCart(tenantSlug: string) {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.cart.getActive.queryOptions({ tenantSlug })
  });
  const cart = query.data;
  return {
    cart,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching
  };
}
