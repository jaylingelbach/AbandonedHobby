'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';

/**
 * Provides a React hook that prunes missing products from the viewer's cart and keeps the viewer's active carts cache in sync.
 *
 * @returns An object with:
 * - `pruneMissingProducts(productIds: string[])` — triggers the prune mutation with the given product IDs.
 * - `pruneMissingProductsAsync(productIds: string[])` — triggers the prune mutation and returns a promise.
 * - `pruneMissingProductsMutation` — the underlying mutation object.
 * - `isPruningMissingProducts` — `true` when the mutation is pending, `false` otherwise.
 */
export function usePruneMissingProductsForViewer() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const basePruneMissingProducts =
    trpc.cart.pruneMissingProducts.mutationOptions();

  const getAllActiveOptions = trpc.cart.getAllActiveForViewer.queryOptions();

  const pruneMissingProductsMutation = useMutation({
    ...basePruneMissingProducts,
    onSuccess: (data, variables, onMutateResult, context) => {
      basePruneMissingProducts.onSuccess?.(
        data,
        variables,
        onMutateResult,
        context
      );

      // Invalidate the "all carts for viewer" cache so checkout data refreshes
      void queryClient.invalidateQueries({
        queryKey: getAllActiveOptions.queryKey
      });
    },
    onError: (error, variables, onMutateResult, context) => {
      basePruneMissingProducts.onError?.(
        error,
        variables,
        onMutateResult,
        context
      );

      if (process.env.NODE_ENV !== 'production') {
        console.error('Error in pruneMissingProducts mutation:', error);
      }
    }
  });

  return {
    pruneMissingProducts: (productIds: string[]) =>
      pruneMissingProductsMutation.mutate({ productIds }),
    pruneMissingProductsAsync: (productIds: string[]) =>
      pruneMissingProductsMutation.mutateAsync({ productIds }),
    pruneMissingProductsMutation,
    isPruningMissingProducts: pruneMissingProductsMutation.isPending
  };
}