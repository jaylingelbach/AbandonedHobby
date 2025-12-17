import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Provide reactive, server-backed cart data and tenant-scoped mutation helpers.
 *
 * @param tenantSlug - Tenant identifier used to scope cart queries and mutations.
 * @returns An object containing:
 *  - `cart`: the active cart data for the given tenant
 *  - query state and controls: `isLoading`, `isError`, `error`, `refetch`, `isFetching`
 *  - synchronous UI helpers with the tenant baked in: `adjustQuantityByDelta`, `incrementItem`, `decrementItem`, `setQuantity`, `removeItem`, `clearCart`
 *  - asynchronous mutation helpers that return mutation results: `incrementItemAsync`, `decrementItemAsync`, `setQuantityAsync`, `removeItemAsync`, `clearCartAsync`
 *  - the raw mutation objects: `adjustQuantityMutation`, `setQuantityMutation`, `removeItemMutation`, `clearCartMutation`
 *  - mutation state flags for UI: `isAdjustingQuantity`, `isSettingQuantity`, `isRemovingItem`, `isClearingCart`
 */
export function useServerCart(tenantSlug?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasTenant = Boolean(tenantSlug);
  // 1) Build queryOptions once so we can reuse queryKey and queryFn
  const getActiveOptions = trpc.cart.getActive.queryOptions({
    tenantSlug: tenantSlug ?? '__placeholder__'
  });
  const getAllActiveOptions = trpc.cart.getAllActiveForViewer.queryOptions();
  const getSummaryOptions = trpc.cart.getSummaryForIdentity.queryOptions();

  // 2) Use them for the main query
  const query = useQuery({
    ...getActiveOptions,
    enabled: hasTenant
  });

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

      // Refresh the global summary used for the badge
      void queryClient.invalidateQueries({
        queryKey: getSummaryOptions.queryKey
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

      // Refresh the global summary used for the badge
      void queryClient.invalidateQueries({
        queryKey: getSummaryOptions.queryKey
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

      // Refresh the global summary used for the badge
      void queryClient.invalidateQueries({
        queryKey: getSummaryOptions.queryKey
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

      // Refresh the global summary used for the badge
      void queryClient.invalidateQueries({
        queryKey: getSummaryOptions.queryKey
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
  const ensureTenantSlug = () => {
    if (!tenantSlug) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useServerCart] mutation called without tenantSlug');
      }
      return null;
    }
    return tenantSlug;
  };

  return {
    cart,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    // for UI use with tenantSlug baked in.
    adjustQuantityByDelta: (productId: string, delta: number) => {
      const slug = ensureTenantSlug();
      if (!slug) return;
      return adjustQuantityMutation.mutate({
        tenantSlug: slug,
        productId,
        delta
      });
    },
    incrementItem: (productId: string) => {
      const slug = ensureTenantSlug();
      if (!slug) return;
      return adjustQuantityMutation.mutate({
        tenantSlug: slug,
        productId,
        delta: 1
      });
    },
    decrementItem: (productId: string) => {
      const slug = ensureTenantSlug();
      if (!slug) return;
      return adjustQuantityMutation.mutate({
        tenantSlug: slug,
        productId,
        delta: -1
      });
    },
    setQuantity: (productId: string, quantity: number) => {
      const slug = ensureTenantSlug();
      if (!slug) return;
      return setQuantityMutation.mutate({
        tenantSlug: slug,
        productId,
        quantity
      });
    },
    removeItem: (productId: string) => {
      const slug = ensureTenantSlug();
      if (!slug) return;
      return removeItemMutation.mutate({ tenantSlug: slug, productId });
    },
    clearCart: () => {
      const slug = ensureTenantSlug();
      if (!slug) return;
      return clearCartMutation.mutate({ tenantSlug: slug });
    },
    // async mutations
    incrementItemAsync: (productId: string) => {
      const slug = ensureTenantSlug();
      if (!slug) return Promise.reject(new Error('Missing tenant slug'));
      return adjustQuantityMutation.mutateAsync({
        tenantSlug: slug,
        productId,
        delta: 1
      });
    },
    decrementItemAsync: (productId: string) => {
      const slug = ensureTenantSlug();
      if (!slug) return Promise.reject(new Error('Missing tenant slug'));
      return adjustQuantityMutation.mutateAsync({
        tenantSlug: slug,
        productId,
        delta: -1
      });
    },

    setQuantityAsync: (productId: string, quantity: number) => {
      const slug = ensureTenantSlug();
      if (!slug) return Promise.reject(new Error('Missing tenant slug'));
      return setQuantityMutation.mutateAsync({
        tenantSlug: slug,
        productId,
        quantity
      });
    },
    removeItemAsync: (productId: string) => {
      const slug = ensureTenantSlug();
      if (!slug) return Promise.reject(new Error('Missing tenant slug'));
      return removeItemMutation.mutateAsync({ tenantSlug: slug, productId });
    },
    clearCartAsync: () => {
      const slug = ensureTenantSlug();
      if (!slug) return Promise.reject(new Error('Missing tenant slug'));
      return clearCartMutation.mutateAsync({ tenantSlug: slug });
    },
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
