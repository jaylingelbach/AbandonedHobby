import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient, trpc } from '@/trpc/server';

import LibraryView from '@/modules/library/ui/views/library-view';
import { DEFAULT_LIMIT } from '@/constants';

const Page = async () => {
  /* ─── Server-side prefetch ───────────────────────────────────────────── */
  const queryClient = getQueryClient();
  void queryClient.prefetchInfiniteQuery(
    trpc.library.getMany.infiniteQueryOptions({
      limit: DEFAULT_LIMIT
    })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LibraryView />
    </HydrationBoundary>
  );
};

export default Page;
