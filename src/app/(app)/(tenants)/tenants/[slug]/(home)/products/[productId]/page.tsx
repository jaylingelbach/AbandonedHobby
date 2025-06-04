import { ProductView } from '@/modules/products/ui/views/product-view';
import { ProductViewSkeleton } from '@/modules/products/ui/views/product-view';
import { getQueryClient, trpc } from '@/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { Suspense } from 'react';

interface Props {
  params: Promise<{ productId: string; slug: string }>;
}

const Page = async ({ params }: Props) => {
  const { productId, slug } = await params;

  /* ── pre-fetch tenant data on the server ─────────────────────────────── */
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.tenants.getOne.queryOptions({ slug })),
    queryClient.prefetchQuery(
      trpc.products.getOne.queryOptions({ id: productId })
    )
  ]);
  return (
    <div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ProductViewSkeleton />}>
          <ProductView productId={productId} tenantSlug={slug} />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
};

export default Page;
