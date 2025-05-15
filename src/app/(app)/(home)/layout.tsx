import { Suspense } from 'react';
import { dehydrate } from '@tanstack/react-query';
import { getQueryClient, trpc } from '@/trpc/server';

import ClientProviders from './clientProviders';

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

  // one dehydrated snapshot — created ONCE on the server
  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <ClientProviders dehydratedState={dehydratedState}>
        <Suspense fallback={<SearchFiltersLoading />}>
          <SearchFilters />
        </Suspense>
      </ClientProviders>

      <div className="flex-1 bg-[#F4F4F0]">{children}</div>

      <Footer />
    </div>
  );
}
