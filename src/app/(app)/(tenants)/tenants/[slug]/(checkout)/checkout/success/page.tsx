import { notFound } from 'next/navigation';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { SearchParams } from 'nuqs/server';
import { trpc, getQueryClient } from '@/trpc/server';
import OrderConfirmationView from '@/modules/checkout/ui/views/order-confirmation-view';

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>; // TEMP unblock
  searchParams: Promise<SearchParams>; // TEMP unblock
}) {
  const [, resolvedSearchParams] = await Promise.all([params, searchParams]);

  const sessionId =
    typeof resolvedSearchParams.session_id === 'string'
      ? resolvedSearchParams.session_id
      : Array.isArray(resolvedSearchParams.session_id)
        ? (resolvedSearchParams.session_id[0] ?? '')
        : '';

  if (!sessionId) notFound();

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery(
      trpc.orders.getConfirmationBySession.queryOptions({ sessionId })
    );
  } catch {
    // swallow 401/500 during SSR; client will refetch + show pending UI
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderConfirmationView sessionId={sessionId} />
    </HydrationBoundary>
  );
}
