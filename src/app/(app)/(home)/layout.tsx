import { Suspense } from 'react';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient, trpc } from '@/trpc/server';

import { Footer } from '@/modules/home/ui/components/footer';
import { Navbar } from '@/modules/home/ui/components/navbar';
import {
  SearchFilters,
  SearchFiltersLoading
} from '@/modules/home/ui/components/search-filters';

interface Props {
  children: React.ReactNode;
}

export default async function Layout({ children }: Props) {
  /* ─── Server-side prefetch ───────────────────────────────────────────── */
  const queryClient = getQueryClient();
  // pre-warm the cache so the first paint is instant
  await queryClient.prefetchQuery(trpc.categories.getMany.queryOptions());

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<SearchFiltersLoading />}>
          <SearchFilters />
        </Suspense>
      </HydrationBoundary>

      <div className="flex-1 bg-[#F4F4F0]">{children}</div>

      <Footer />
    </div>
  );
}
