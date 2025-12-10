import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Provides reactive, server-backed cart data and mutation helpers for a given tenant.
 *
 * @param tenantSlug - The tenant identifier used to scope cart queries and mutations.
 * @returns An object containing:
 *  - `cart`: the active cart data for the tenant
 *  - query state and controls: `isLoading`, `isError`, `error`, `refetch`, `isFetching`
 *  - synchronous UI helpers to modify the cart with the tenant baked in: `adjustQuantityByDelta`, `incrementItem`, `decrementItem`, `setQuantity`, `removeItem`, `clearCart`
 *  - asynchronous mutation helpers that return the mutation result: `incrementItemAsync`, `decrementItemAsync`, `setQuantityAsync`, `removeItemAsync`, `clearCartAsync`
 *  - the raw mutation objects: `adjustQuantityMutation`, `setQuantityMutation`, `removeItemMutation`, `clearCartMutation`
 *  - mutation state flags for UI: `isAdjustingQuantity`, `isSettingQuantity`, `isRemovingItem`, `isClearingCart`
 */
export function useServerCart(tenantSlug: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // 1) Build queryOptions once so we can reuse queryKey and queryFn
  const getActiveOptions = trpc.cart.getActive.queryOptions({ tenantSlug });
  const getAllActiveOptions = trpc.cart.getAllActiveForViewer.queryOptions();

  // 2) Use them for the main query
  const query = useQuery(getActiveOptions);

  const baseAdjustQuantityByDelta =
    trpc.cart.adjustQuantityByDelta.mutationOptions();

  const baseSetQuantityMutation = trpc.cart.setQuantity.mutationOptions();

  const baseRemoveItemMutation = trpc.cart.removeItem.mutationOptions();

  const baseClearCartMutation = trpc.cart.clearCart.mutationOptions();

  // 3) Mutation that invalidates the same queryKey
  const adjustQuantityMutation = useMutation({
    ...baseAdjustQuantityByDelta,
    onSuccess: (data, variables, onMutateResult, context) => {
      baseAdjustQuantityByDelta.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context
      );
      // Update the per-tenant cart cache
      queryClient.setQueryData(getActiveOptions.queryKey, data);

      // Also refresh the "all carts for viewer" cache
      void queryClient.invalidateQueries({
        queryKey: getAllActiveOptions.queryKey
      });
    },
    onError: (error, variables, onMutateResult, context) => {
      baseAdjustQuantityByDelta.onError?.(
        error,
        variables,
        onMutateResult,
        context
      );
      console.error('Error adjusting quantity by delta:', error);
    }
  });

  const setQuantityMutation = useMutation({
    ...baseSetQuantityMutation,
    onSuccess: (data, variables, onMutateResult, context) => {
      baseSetQuantityMutation.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context
      );

      // Update the per-tenant cart cache
      queryClient.setQueryData(getActiveOptions.queryKey, data);

      // Also refresh the "all carts for viewer" cache
      void queryClient.invalidateQueries({
        queryKey: getAllActiveOptions.queryKey
      });
    },
    onError: (error, variables, onMutateResult, context) => {
      baseSetQuantityMutation.onError?.(
        error,
        variables,
        onMutateResult,
        context
      );
      console.error('Error setting quantity: ', error);
    }
  });
  const removeItemMutation = useMutation({
    ...baseRemoveItemMutation,
    onSuccess: (data, variables, onMutateResult, context) => {
      baseRemoveItemMutation.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context
      );

      // Update the per-tenant cart cache
      queryClient.setQueryData(getActiveOptions.queryKey, data);

      // Also refresh the "all carts for viewer" cache
      void queryClient.invalidateQueries({
        queryKey: getAllActiveOptions.queryKey
      });
    },
    onError: (error, variables, onMutateResult, context) => {
      baseRemoveItemMutation.onError?.(
        error,
        variables,
        onMutateResult,
        context
      );
      console.error('Error removing item: ', error);
    }
  });

  const clearCartMutation = useMutation({
    ...baseClearCartMutation,
    onSuccess: (data, variables, onMutateResult, context) => {
      baseClearCartMutation.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context
      );

      // Update the per-tenant cart cache
      queryClient.setQueryData(getActiveOptions.queryKey, data);

      // Also refresh the "all carts for viewer" cache
      void queryClient.invalidateQueries({
        queryKey: getAllActiveOptions.queryKey
      });
    },
    onError: (error, variables, onMutateResult, context) => {
      baseClearCartMutation.onError?.(
        error,
        variables,
        onMutateResult,
        context
      );
      console.error('Error clearing the cart: ', error);
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
    // for UI use with tenantSlug baked in.
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
    // async mutations
    incrementItemAsync: (productId: string) =>
      adjustQuantityMutation.mutateAsync({ tenantSlug, productId, delta: 1 }),
    decrementItemAsync: (productId: string) =>
      adjustQuantityMutation.mutateAsync({ tenantSlug, productId, delta: -1 }),
    setQuantityAsync: (productId: string, quantity: number) =>
      setQuantityMutation.mutateAsync({ tenantSlug, productId, quantity }),
    removeItemAsync: (productId: string) =>
      removeItemMutation.mutateAsync({ tenantSlug, productId }),
    clearCartAsync: () => clearCartMutation.mutateAsync({ tenantSlug }),
    // return full mutation
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
