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
import {
  getCardImageURL,
  getTenantImageURL,
  getTenantSlug
} from '../utils/utils';

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

  // Keep signatures so we don't duplicate analytics events
  const performedSigRef = useRef<string>('');
  const noResultsSigRef = useRef<string>('');

  // ---- Normalize filters ----------------------------------------------------

  // Prefer q, fall back to legacy search; send undefined when empty
  const qNormalized = (filters.q || filters.search || '').trim() || undefined;

  // Convert empty strings/arrays to undefined so the server skips those filters
  const minPrice = filters.minPrice ? filters.minPrice : undefined;
  const maxPrice = filters.maxPrice ? filters.maxPrice : undefined;
  const tags =
    Array.isArray(filters.tags) && filters.tags.length
      ? filters.tags
      : undefined;

  // Build a clean input object — do NOT spread the raw filters object
  const input = useMemo(
    () => ({
      category,
      subcategory,
      tenantSlug,
      limit: DEFAULT_LIMIT,

      // canonical text filter expected by backend & included in query key
      q: qNormalized,

      // other filters
      sort: filters.sort,
      minPrice,
      maxPrice,
      tags
    }),
    [
      category,
      subcategory,
      tenantSlug,
      qNormalized,
      filters.sort,
      minPrice,
      maxPrice,
      tags
    ]
  );

  // ---- Query ---------------------------------------------------------------

  const queryOpts = trpc.products.getMany.infiniteQueryOptions(input, {
    getNextPageParam: (lastPage) =>
      lastPage.docs.length > 0 ? lastPage.nextPage : undefined
  });

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(queryOpts);

  // ---- Analytics -----------------------------------------------------------

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
    if (pages.length !== 1) return; // only on first page

    const first = pages[0] as { totalDocs?: number; docs: unknown[] };

    const qForAnalytics = input.q ?? '';
    const hasFilters = computeHasFilters(input);

    const resultCount =
      typeof first.totalDocs === 'number' ? first.totalDocs : first.docs.length;

    if (resultCount === 0) return;

    const signature = JSON.stringify({
      q: qForAnalytics,
      category: input.category,
      subcategory: input.subcategory,
      priceRange: [input.minPrice, input.maxPrice],
      tags: input.tags,
      sort: input.sort,
      hasFilters,
      tenant: input.tenantSlug ?? undefined,
      resultCount
    });

    if (signature === performedSigRef.current) return;
    performedSigRef.current = signature;

    capture('searchPerformed', {
      queryLength: qForAnalytics.length,
      hasFilters,
      tenantSlug: input.tenantSlug ?? undefined,
      resultCount
    });
  }, [data, input]);

  useEffect(() => {
    const firstDocs = data?.pages?.[0]?.docs ?? [];
    if (firstDocs.length === 0) {
      const signature = JSON.stringify({
        q: input.q ?? '',
        filters: input
      });
      if (signature === noResultsSigRef.current) return;
      noResultsSigRef.current = signature;

      capture('searchNoResults', {
        queryLength: (input.q ?? '').length,
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

  // ---- UI ------------------------------------------------------------------

  if (data?.pages?.[0]?.docs.length === 0) {
    return (
      <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-y-4 bg-white rounded-lg">
        <InboxIcon />
        <p className="text-base font-medium">No products found</p>
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
          .map((product) => {
            const cardImageURL = getCardImageURL(product);
            const tenantSlugSafe = getTenantSlug(product);
            const tenantImageURLSafe = getTenantImageURL(product);

            return (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                imageURL={cardImageURL}
                tenantSlug={tenantSlugSafe ?? ''} // pass empty string if missing
                tenantImageURL={tenantImageURLSafe ?? null} // null if no image
                reviewRating={product.reviewRating}
                reviewCount={product.reviewCount}
                price={product.price}
              />
            );
          })}
      </div>

      <div className="flex justify-center pt-8">
        {hasNextPage && (
          <Button
            disabled={isFetchingNextPage}
            onClick={() => {
              capture('searchLoadMore', {
                queryLength: (input.q ?? '').length,
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
