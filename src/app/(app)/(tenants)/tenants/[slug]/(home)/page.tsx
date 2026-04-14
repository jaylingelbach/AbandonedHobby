import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'nuqs/server';

import { DEFAULT_LIMIT } from '@/constants';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { caller, getQueryClient, trpc } from '@/trpc/server';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getTenantImageURLSafe, getTenantNameSafe } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<SearchParams>;
  params: Promise<{ slug: string }>;
}

const getTenant = cache((slug: string) => caller.tenants.getOne({ slug }));

export async function generateMetadata({
  params
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tenant = await getTenant(slug);
    const tenantName = getTenantNameSafe(tenant) ?? slug;
    const tenantImageUrl =
      getTenantImageURLSafe(tenant, 'medium') ?? '/open-graph-image.png';

    const description = `Check out this seller ${tenantName} on Abandoned Hobby`;
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.abandonedhobby.com'}/tenants/${slug}`;
    return {
      title: tenantName,
      description,
      openGraph: {
        type: 'website',
        url,
        images: [
          {
            url: tenantImageUrl
          }
        ]
      }
    };
  } catch (error) {
    console.error('Failed to generate tenant metadata:', error);
    return { title: 'Seller on Abandoned Hobby' };
  }
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
