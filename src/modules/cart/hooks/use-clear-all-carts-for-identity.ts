import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useClearAllCartsForIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // 1) Build queryOptions once so we can reuse queryKey and queryFn

  const getAllActiveOptions = trpc.cart.getAllActiveForViewer.queryOptions();
  const getSummaryOptions = trpc.cart.getSummaryForIdentity.queryOptions();

  const baseClearAllCartsForIdentity =
    trpc.cart.clearAllCartsForIdentity.mutationOptions();

  const clearAllCartsForIdentityMutation = useMutation({
    ...baseClearAllCartsForIdentity,
    onSuccess: (data, variables, onMutateResult, context) => {
      baseClearAllCartsForIdentity.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context
      );

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
      baseClearAllCartsForIdentity.onError?.(
        error,
        variables,
        onMutateResult,
        context
      );
      console.error('Error clearing cart for identity: ', error);
    }
  });
  return {
    clearAllCartsForIdentityMutation,
    isClearingAllCart: clearAllCartsForIdentityMutation.isPending,
    clearAllCartsForIdentity: () => {
      clearAllCartsForIdentityMutation.mutate();
    },
    clearAllCartsForIdentityAsync: () =>
      clearAllCartsForIdentityMutation.mutateAsync()
  };
}
