'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';

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
      // eslint-disable-next-line no-console
      console.error('Error in pruneMissingProducts mutation:', error);
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
