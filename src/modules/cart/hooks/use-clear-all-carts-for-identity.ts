import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook that provides a mutation and helpers to clear all carts for the current identity.
 *
 * On successful mutation, invalidates cached queries for the viewer's active carts and the identity's cart summary.
 * On error, delegates to the base error handler if present and logs the error to the console.
 *
 * @returns An object with:
 * - `clearAllCartsForIdentityMutation` — the underlying React Query mutation object for clearing carts.
 * - `isClearingAllCart` — `true` when the clear-all-carts mutation is pending, `false` otherwise.
 * - `clearAllCartsForIdentity` — a function that triggers the clear-all-carts mutation synchronously.
 * - `clearAllCartsForIdentityAsync` — a function that triggers the clear-all-carts mutation asynchronously and resolves with the mutation result.
 */
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