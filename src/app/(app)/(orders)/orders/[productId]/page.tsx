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
    if (!session.user) redirect('/sign-in?next=/orders');
  } catch {
    redirect('/sign-in?next=/orders');
  }
  /* ─── Server-side prefetch ───────────────────────────────────────────── */
  const queryClient = getQueryClient();
  // library prefetch
  void queryClient.prefetchQuery(
    trpc.library.getOne.queryOptions({
      productId
    })
  );
  // review prefetch
  void queryClient.prefetchQuery(
    trpc.reviews.getOne.queryOptions({
      productId
    })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ProductViewSkeleton />}>
        <ProductView productId={productId} />
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
