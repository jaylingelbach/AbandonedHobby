import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { caller, getQueryClient, trpc } from '@/trpc/server';

import {
  ProductView,
  ProductViewSkeleton
} from '@/modules/library/ui/views/product-view';

export const dynamic = 'force-dynamic';

export default async function Page({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  try {
    const session = await caller.auth.session();
    if (!session.user) {
      redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}`)}`);
    }
  } catch {
    redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  }

  // Load the order on the server to discover its productId
  const orderDTO = await caller.orders.getForBuyerById({ orderId }); // returns { productId, ... }

  const queryClient = getQueryClient();

  // Prefetch everything the client will need
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.orders.getForBuyerById.queryOptions({ orderId })
    ),
    queryClient.prefetchQuery(
      trpc.library.getOne.queryOptions({ productId: orderDTO.productId })
    ),
    queryClient.prefetchQuery(
      trpc.reviews.getOne.queryOptions({ productId: orderDTO.productId })
    )
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ProductViewSkeleton />}>
        <ProductView productId={orderDTO.productId} orderId={orderId} />
      </Suspense>
    </HydrationBoundary>
  );
}
