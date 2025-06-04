import { SearchParams } from 'nuqs/server';
import { getQueryClient, trpc } from '@/trpc/server';
import { DEFAULT_LIMIT } from '@/constants';

import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { loadProductFilters } from '@/modules/products/search-params';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

interface PageProps {
  searchParams: Promise<SearchParams>;
  params: Promise<{ slug: string }>;
}

const Page = async ({ searchParams, params }: PageProps) => {
  const { slug } = await params;
  const filters = await loadProductFilters(searchParams);

  const queryClient = getQueryClient();
  void queryClient.prefetchInfiniteQuery(
    trpc.products.getMany.infiniteQueryOptions({
      ...filters,
      tenantSlug: slug,
      limit: DEFAULT_LIMIT
    })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductListView tenantSlug={slug} narrowView />
    </HydrationBoundary>
  );
};

export default Page;
