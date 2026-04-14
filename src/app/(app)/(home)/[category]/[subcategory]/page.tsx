import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { SearchParams } from 'nuqs/server';

import { DEFAULT_LIMIT } from '@/constants';
import { categoryNameFromSlug } from '@/lib/categories';
import { isValidCategoryAndSub } from '@/lib/server/utils';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { getQueryClient, trpc } from '@/trpc/server';

import type { Metadata } from 'next';

interface Props {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, subcategory } = await params;
  const categoryName = categoryNameFromSlug(category) ?? category;
  const subcategoryName = categoryNameFromSlug(subcategory) ?? subcategory;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.abandonedhobby.com'}/${category}/${subcategory}`;

  return {
    title: `${subcategoryName} in ${categoryName}`,
    description: `Browse ${subcategoryName} in ${categoryName} on Abandoned Hobby. Find secondhand hobby gear, craft supplies, and creative tools.`,
    openGraph: {
      type: 'website',
      url,
      images: [{ url: '/open-graph-image.png' }]
    }
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { category, subcategory } = await params;
  if (!(await isValidCategoryAndSub(category, subcategory))) return notFound();
  const filters = await loadProductFilters(searchParams);

  const queryClient = getQueryClient();

  const input = {
    ...filters,
    category,
    subcategory,
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
      <ProductListView category={category} subcategory={subcategory} />
    </HydrationBoundary>
  );
}
