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

  const sessionIdParam = resolvedSearchParams.session_id;
  const sessionId = Array.isArray(sessionIdParam)
    ? sessionIdParam[0]
    : sessionIdParam || '';

  if (!sessionId) notFound();

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery(
      trpc.orders.getConfirmationBySession.queryOptions({ sessionId })
    );
  } catch {
    console.warn('Prefetch failed for session:', sessionId);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderConfirmationView sessionId={sessionId} />
    </HydrationBoundary>
  );
}
