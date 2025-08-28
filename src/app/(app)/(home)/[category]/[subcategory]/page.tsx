import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'nuqs/server';

import { getQueryClient, trpc } from '@/trpc/server';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { DEFAULT_LIMIT } from '@/constants';

interface Props {
  params: { category: string; subcategory: string };
  searchParams: SearchParams;
}

export default async function Page({ params, searchParams }: Props) {
  const { category, subcategory } = params;
  const filters = await loadProductFilters(searchParams);

  const queryClient = getQueryClient();

  // Prefetch with BOTH slugs (single call — no nesting)
  void queryClient.prefetchInfiniteQuery(
    trpc.products.getMany.infiniteQueryOptions({
      ...filters,
      category,
      subcategory,
      limit: DEFAULT_LIMIT
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductListView category={category} subcategory={subcategory} />
    </HydrationBoundary>
  );
}
