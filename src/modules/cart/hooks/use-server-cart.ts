import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useServerCart(tenantSlug: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // 1) Build queryOptions once so we can reuse queryKey and queryFn
  const getActiveOptions = trpc.cart.getActive.queryOptions({ tenantSlug });

  // 2) Use them for the main query
  const query = useQuery(getActiveOptions);

  // 3) Mutation that invalidates the same queryKey
  const adjustQuantityMutation = useMutation({
    ...trpc.cart.adjustQuantityByDelta.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(getActiveOptions.queryKey, data);
    },
    onError: (error) => {
      console.error(`Error adjusting quantity  by delta: ${error}`);
    }
  });
  const setQuantityMutation = useMutation({
    ...trpc.cart.setQuantity.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(getActiveOptions.queryKey, data);
    },
    onError: (error) => {
      console.error(`Error setting quantity: ${error}`);
    }
  });

  const removeItemMutation = useMutation({
    ...trpc.cart.removeItem.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(getActiveOptions.queryKey, data);
    },
    onError: (error) => {
      console.error(`Error removing item: ${error}`);
    }
  });

  const clearCartMutation = useMutation({
    ...trpc.cart.clearCart.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(getActiveOptions.queryKey, data);
    },
    onError: (error) => {
      console.error(`Error clearning the cart: ${error}`);
    }
  });
  const cart = query.data;
  return {
    cart,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,

    adjustQuantityByDelta: (productId: string, delta: number) =>
      adjustQuantityMutation.mutate({ tenantSlug, productId, delta }),
    incrementItem: (productId: string) =>
      adjustQuantityMutation.mutate({ tenantSlug, productId, delta: 1 }),
    decrementItem: (productId: string) =>
      adjustQuantityMutation.mutate({ tenantSlug, productId, delta: -1 }),
    setQuantity: (productId: string, quantity: number) =>
      setQuantityMutation.mutate({ tenantSlug, productId, quantity }),
    removeItem: (productId: string) =>
      removeItemMutation.mutate({ tenantSlug, productId }),
    clearCart: () => {
      clearCartMutation.mutate({ tenantSlug });
    },
    adjustQuantityMutation,
    setQuantityMutation,
    removeItemMutation,
    clearCartMutation,
    // mutation flags for the UI:
    isAdjustingQuantity: adjustQuantityMutation.isPending,
    isSettingQuantity: setQuantityMutation.isPending,
    isRemovingItem: removeItemMutation.isPending,
    isClearingCart: clearCartMutation.isPending
  };
}
