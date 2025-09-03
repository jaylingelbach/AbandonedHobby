import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient, trpc } from '@/trpc/server';

import LibraryView from '@/modules/library/ui/views/library-view';
import { DEFAULT_LIMIT } from '@/constants';
import { caller } from '@/trpc/server';
import { redirect } from 'next/navigation';

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
