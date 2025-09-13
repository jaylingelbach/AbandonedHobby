'use client';

import { useEffect, useMemo, useRef } from 'react';
import { InboxIcon } from 'lucide-react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import { ProductCard, ProductCardSkeleton } from './product-card';
import { useProductFilters } from '../../hooks/use-product-filters';
import { Button } from '@/components/ui/button';
import { DEFAULT_LIMIT } from '@/constants';
import { capture } from '@/lib/analytics/ph-utils/ph';

interface Props {
  category?: string;
  subcategory?: string;
  tenantSlug?: string;
  narrowView?: boolean;
}

export const ProductList = ({
  category,
  subcategory,
  tenantSlug,
  narrowView
}: Props) => {
  const [filters] = useProductFilters();
  const trpc = useTRPC();
  const lastSigRef = useRef<string>('');

  const input = useMemo(
    () => ({
      ...filters,
      category,
      subcategory,
      tenantSlug,
      limit: DEFAULT_LIMIT
    }),
    [filters, category, subcategory, tenantSlug]
  );

  const queryOpts = trpc.products.getMany.infiniteQueryOptions(input, {
    getNextPageParam: (lastPage) =>
      lastPage.docs.length > 0 ? lastPage.nextPage : undefined
  });

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(queryOpts);

  // Fire analytics ONLY for the first page of a search/filter combo
  useEffect(() => {
    const computeHasFilters = (i: typeof input) =>
      Boolean(i.category) ||
      Boolean(i.subcategory) ||
      Boolean(i.minPrice) ||
      Boolean(i.maxPrice) ||
      (Array.isArray(i.tags) && i.tags.length > 0) ||
      Boolean(i.sort) ||
      Boolean(i.tenantSlug);
    const pages = data?.pages ?? [];
    if (pages.length !== 1) return; // ignore "Load more" etc.

    const first = pages[0] as { totalDocs?: number; docs: unknown[] };

    const q = (input.search ?? '') as string;
    const hasFilters = computeHasFilters(input);

    const resultCount =
      typeof first.totalDocs === 'number' ? first.totalDocs : first.docs.length;

    const sig = JSON.stringify({
      q: q,
      category: input.category,
      subcategory: input.subcategory,
      priceRange: [input.minPrice, input.maxPrice],
      tags: input.tags,
      sort: input.sort,
      hasFilters,
      tenant: input.tenantSlug ?? undefined,
      resultCount
    });
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    capture('searchPerformed', {
      queryLength: q.length,
      hasFilters,
      tenantSlug: input.tenantSlug ?? undefined,
      resultCount
    });
  }, [data, input]);

  // Optional: explicit "no results" event
  const lastNoResultsSigRef = useRef<string>('');

  useEffect(() => {
    if (data?.pages?.[0]?.docs.length === 0) {
      const sig = JSON.stringify({
        q: input.search ?? '',
        filters: input
      });
      if (sig === lastNoResultsSigRef.current) return;
      lastNoResultsSigRef.current = sig;

      capture('searchNoResults', {
        queryLength: (input.search ?? '').length,
        hasFilters:
          Boolean(input.category) ||
          Boolean(input.subcategory) ||
          Boolean(input.minPrice) ||
          Boolean(input.maxPrice) ||
          (Array.isArray(input.tags) && input.tags.length > 0) ||
          Boolean(input.sort) ||
          Boolean(input.tenantSlug),
        tenantSlug: input.tenantSlug ?? undefined
      });
    }
  }, [data, input]);

  if (data?.pages?.[0]?.docs.length === 0) {
    return (
      <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-y-4 bg-white rounded-lg">
        <InboxIcon />
        <p className="text-base font-medium">No products found </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4',
          narrowView && 'lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3'
        )}
      >
        {data?.pages
          .flatMap((page) => page.docs)
          .map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              imageURL={product.image?.url}
              tenantSlug={product.tenant?.slug}
              tenantImageURL={product.tenant?.image?.url}
              reviewRating={product.reviewRating}
              reviewCount={product.reviewCount}
              price={product.price}
            />
          ))}
      </div>
      <div className="flex justify-center pt-8">
        {hasNextPage && (
          <Button
            disabled={isFetchingNextPage}
            onClick={() => {
              capture('searchLoadMore', {
                queryLength: (input.search ?? '').length,
                tenantSlug: input.tenantSlug ?? undefined
              });
              fetchNextPage();
            }}
            className="font-medium disabled:opacity-50 text-base bg-white"
            variant="elevated"
          >
            Load more
          </Button>
        )}
      </div>
    </>
  );
};

export const ProductListSkeleton = ({
  narrowView
}: {
  narrowView?: boolean;
}) => {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4',
        narrowView && 'lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3'
      )}
    >
      {Array.from({ length: DEFAULT_LIMIT }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
};
