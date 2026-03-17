import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'nuqs/server';

import { DEFAULT_LIMIT } from '@/constants';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { getQueryClient, trpc } from '@/trpc/server';

interface PageProps {
  searchParams: Promise<SearchParams>;
  params: Promise<{ slug: string }>;
}

const Page = async ({ searchParams, params }: PageProps) => {
  const { slug } = await params;
  const filters = await loadProductFilters(searchParams);

  const queryClient = getQueryClient();
  const input = {
    ...filters,
    tenantSlug: slug,
    limit: DEFAULT_LIMIT
  };
  void queryClient.prefetchInfiniteQuery(
    trpc.products.getMany.infiniteQueryOptions(input, {
      getNextPageParam: (lastPage) =>
        lastPage.docs.length > 0 ? lastPage.nextPage : undefined
    })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductListView tenantSlug={slug} narrowView />
    </HydrationBoundary>
  );
};

export default Page;
