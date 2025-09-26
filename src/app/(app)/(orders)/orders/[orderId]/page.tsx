import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { redirect, notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  ProductView,
  ProductViewSkeleton
} from '@/modules/library/ui/views/product-view';
import { caller, getQueryClient, trpc } from '@/trpc/server';


export const dynamic = 'force-dynamic';

export default async function Page({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // 1) Make sure the user is signed in (server-side)
  try {
    const session = await caller.auth.session();
    if (!session.user) {
      redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}`)}`);
    }
  } catch {
    redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  }

  const queryClient = getQueryClient();

  // 2) Prefetch session into the cache so client queries don’t 401 on first paint
  await queryClient.prefetchQuery(trpc.auth.session.queryOptions());

  // 3) Fetch the order on the server (you already do this to get productId)
  let orderDTO;
  try {
    orderDTO = await caller.orders.getForBuyerById({ orderId });
  } catch {
    return notFound();
  }

  // 4) HYDRATE that same result under the same query key your client uses
  const orderQ = trpc.orders.getForBuyerById.queryOptions({ orderId });
  queryClient.setQueryData(orderQ.queryKey, orderDTO);

  // 5) Prefetch other data the client view needs
  await Promise.allSettled([
    queryClient.prefetchQuery(
      trpc.library.getOne.queryOptions({ productId: orderDTO.productId })
    ),
    queryClient.prefetchQuery(
      trpc.reviews.getOne.queryOptions({ productId: orderDTO.productId })
    )
  ]);

  // 6) Dehydrate + render
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ProductViewSkeleton />}>
        <ProductView productId={orderDTO.productId} orderId={orderId} />
      </Suspense>
    </HydrationBoundary>
  );
}
