'use client';

import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { InboxIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DEFAULT_LIMIT } from '@/constants';
import { useTRPC } from '@/trpc/client';

import { ProductCard, ProductCardSkeleton } from './product-card';

export const ProductList = () => {
  const trpc = useTRPC();
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.library.getMany.infiniteQueryOptions(
        { limit: DEFAULT_LIMIT },
        {
          getNextPageParam: (lastPage) =>
            lastPage.docs.length > 0 ? lastPage.nextPage : undefined
        }
      )
    );

  // 1) Flatten
  const rows = data?.pages.flatMap((product) => product.docs) ?? [];

  // 2) Group ONLY by orderId (skip rows without an orderId)
  type Row = (typeof rows)[number];
  const byOrder = new Map<string, Row[]>();
  for (const row of rows) {
    if (typeof row.orderId !== 'string' || row.orderId.length === 0) continue;
    const bucket = byOrder.get(row.orderId) ?? [];
    bucket.push(row);
    byOrder.set(row.orderId, bucket);
  }

  // 3) One card per order
  const cards = Array.from(byOrder.entries()).map(([orderId, items]) => {
    const first = items[0]!;
    const extraCount = items.length - 1;

    // Safe base title from the first item; never undefined
    const baseTitle = (typeof first.name === 'string' && first.name) || 'Order';

    const title =
      extraCount > 0 ? `${baseTitle} (+${extraCount} more)` : baseTitle;

    return {
      orderId,
      title,
      imageURL: first.image?.url ?? null,
      tenantSlug: first.tenant?.slug ?? '',
      tenantImageURL: first.tenant?.image?.url ?? null,
      reviewRating:
        typeof first.reviewRating === 'number' ? first.reviewRating : 0,
      reviewCount: typeof first.reviewCount === 'number' ? first.reviewCount : 0
    };
  });

  if (cards.length === 0) {
    return (
      <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-y-4 bg-white rounded-lg">
        <InboxIcon />
        <p className="text-base font-medium">No orders found</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <ProductCard
            key={card.orderId}
            orderId={card.orderId}
            name={card.title}
            imageURL={card.imageURL}
            tenantSlug={card.tenantSlug}
            tenantImageURL={card.tenantImageURL}
            reviewRating={card.reviewRating}
            reviewCount={card.reviewCount}
          />
        ))}
      </div>

      <div className="flex justify-center pt-8">
        {hasNextPage && (
          <Button
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
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

export const ProductListSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
    {Array.from({ length: DEFAULT_LIMIT }).map((_, index) => (
      <ProductCardSkeleton key={index} />
    ))}
  </div>
);
