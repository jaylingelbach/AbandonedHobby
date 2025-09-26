import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { SearchParams } from 'nuqs/server';

import { DEFAULT_LIMIT } from '@/constants';
import { isValidCategoryAndSub } from '@/lib/server/utils';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { getQueryClient, trpc } from '@/trpc/server';

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
