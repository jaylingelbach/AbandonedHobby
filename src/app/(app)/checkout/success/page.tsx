import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import OrderConfirmationView from '@/modules/checkout/ui/views/order-confirmation-view';
import { trpc, getQueryClient } from '@/trpc/server';

import type { SearchParams } from 'nuqs/server';


/**
 * Server component page that renders the order confirmation view for a Stripe session.
 *
 * Resolves route props, extracts `session_id` from `searchParams` (handles string or array),
 * and returns the OrderConfirmationView wrapped with a HydrationBoundary containing
 * server-prefetched query state for that session.
 *
 * If `session_id` is missing or empty, this triggers a 404 via `notFound()`.
 * The function attempts to prefetch the `orders.getConfirmationBySession` tRPC query;
 * prefetch failures do not abort rendering (a warning is logged) but may result in
 * missing client-side cache.
 *
 * @param searchParams - Promise resolving to search parameters; `searchParams.session_id` is used to determine the session to show.
 * @returns A React element containing the hydrated OrderConfirmationView for the resolved session.
 */

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
