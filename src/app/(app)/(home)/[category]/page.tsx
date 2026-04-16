import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { DEFAULT_LIMIT } from '@/constants';
import { isValidCategory } from '@/lib/server/utils';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { getQueryClient, trpc } from '@/trpc/server';

import type { SearchParams } from 'nuqs/server';
import type { Metadata } from 'next';
import { categoryNameFromSlug } from '@/lib/categories';

interface Props {
  params: Promise<{
    category: string;
  }>;
  searchParams: Promise<SearchParams>;
}

/**
 * Build page metadata for a category route using the route params.
 *
 * @param params - Route params containing the `category` slug used to derive the display name and canonical URL
 * @returns A `Metadata` object whose `title` is the derived category name (falls back to the slug), a description referencing that name, and an `openGraph` entry with `type: "website"`, the canonical URL for the category, and an image at `/og-1.png`
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const categoryName = categoryNameFromSlug(category) ?? category;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.abandonedhobby.com'}/${category}`;

  return {
    title: categoryName,
    description: `Browse ${categoryName} on Abandoned Hobby. Find secondhand hobby gear, craft supplies, and creative tools.`,
    openGraph: {
      type: 'website',
      url,
      images: [{ url: '/og-1.png' }]
    }
  };
}

const Page = async ({ params, searchParams }: Props) => {
  const { category } = await params;
  if (!(await isValidCategory(category))) return notFound();
  const filters = await loadProductFilters(searchParams);

  const queryClient = getQueryClient();

  const input = {
    ...filters,
    category,
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
      <ProductListView category={category} />
    </HydrationBoundary>
  );
};

export default Page;
