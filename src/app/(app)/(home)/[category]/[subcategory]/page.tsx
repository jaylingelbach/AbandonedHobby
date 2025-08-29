import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'nuqs/server';

import { getQueryClient, trpc } from '@/trpc/server';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { DEFAULT_LIMIT } from '@/constants';
import { isValidCategoryAndSub } from '@/lib/server/utils';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<SearchParams>;
}

export default async function Page({ params, searchParams }: Props) {
  const { category, subcategory } = await params;
  if (!(await isValidCategoryAndSub(category, subcategory))) return notFound();
  const filters = await loadProductFilters(await searchParams);

  const queryClient = getQueryClient();

  // Prefetch with BOTH slugs
  void queryClient.prefetchInfiniteQuery(
    trpc.products.getMany.infiniteQueryOptions({
      ...filters,
      category,
      subcategory,
      limit: DEFAULT_LIMIT,
      cursor: 1
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductListView category={category} subcategory={subcategory} />
    </HydrationBoundary>
  );
}
