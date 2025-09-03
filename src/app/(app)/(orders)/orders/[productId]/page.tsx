import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { caller, getQueryClient, trpc } from '@/trpc/server';
import {
  ProductView,
  ProductViewSkeleton
} from '@/modules/library/ui/views/product-view';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ productId: string }>;
}

export const dynamic = 'force-dynamic';

const Page = async ({ params }: Props) => {
  const { productId } = await params;
  try {
    const session = await caller.auth.session();
    if (!session.user)
      redirect(`/sign-in?next=${encodeURIComponent(`/orders/${productId}`)}`);
  } catch {
    redirect(`/sign-in?next=${encodeURIComponent(`/orders/${productId}`)}`);
  }
  /* ─── Server-side prefetch ───────────────────────────────────────────── */
  const queryClient = getQueryClient();
  // await library and review prefetches
  await Promise.all([
    queryClient.prefetchQuery(trpc.library.getOne.queryOptions({ productId })),
    queryClient.prefetchQuery(trpc.reviews.getOne.queryOptions({ productId }))
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ProductViewSkeleton />}>
        <ProductView productId={productId} />
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
