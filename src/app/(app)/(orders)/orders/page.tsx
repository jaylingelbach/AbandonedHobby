import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import { DEFAULT_LIMIT } from '@/constants';
import LibraryView from '@/modules/library/ui/views/library-view';
import { getQueryClient, trpc } from '@/trpc/server';
import { caller } from '@/trpc/server';

export const dynamic = 'force-dynamic';

const Page = async () => {
  try {
    const session = await caller.auth.session();
    if (!session.user) redirect('/sign-in?next=/orders');
  } catch {
    redirect('/sign-in?next=/orders');
  }
  /* ─── Server-side prefetch ───────────────────────────────────────────── */
  const queryClient = getQueryClient();
  const input = {
    limit: DEFAULT_LIMIT
  };
  void queryClient.prefetchInfiniteQuery(
    trpc.library.getMany.infiniteQueryOptions(input, {
      getNextPageParam: (lastPage) =>
        lastPage.docs.length > 0 ? lastPage.nextPage : undefined
    })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LibraryView />
    </HydrationBoundary>
  );
};

export default Page;
