import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import OrderConfirmationView from '@/modules/checkout/ui/views/order-confirmation-view';
import { trpc, getQueryClient } from '@/trpc/server';

import type { SearchParams } from 'nuqs/server';


export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
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
