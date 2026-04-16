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

/**
 * Builds metadata for a category/subcategory route using the route slugs.
 *
 * @param params - An object whose `params` resolves to `{ category, subcategory }` route slugs used to derive display names and the canonical URL.
 * @returns A Metadata object containing a page `title`, `description`, and `openGraph` data (including the page URL and a static image) appropriate for the category/subcategory page.
 */
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
      images: [{ url: '/og-1.png' }]
    }
  };
}

/**
 * Render the product listing page for a category and subcategory while prefilling React Query state.
 *
 * If the provided category/subcategory pair is invalid, triggers Next.js `notFound()` to render a 404 page.
 *
 * @param params - Promise resolving to route params containing `category` and `subcategory`
 * @param searchParams - Promise resolving to query/search parameters used to build product filters
 * @returns A React element containing a hydrated ProductListView for the resolved category and subcategory
 */
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
