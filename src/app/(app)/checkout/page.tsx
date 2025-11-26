import CheckoutView from '@/modules/checkout/ui/views/checkout-view';
import { trpc, getQueryClient } from '@/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { SearchParams } from 'nuqs';

/**
 * Server page that renders the checkout view for a Stripe session and hydrates prefetched order confirmation data.
 *
 * Extracts `session_id` from `searchParams`, triggers a 404 if missing, attempts to prefetch order confirmation for that session
 * into a react-query client, and renders `CheckoutView` inside a `HydrationBoundary` seeded with the dehydrated query state.
 *
 * @param params - A promise resolving to an object with a `slug` property (not used by this page).
 * @param searchParams - A promise resolving to `SearchParams`; `session_id` is read from this object to identify the checkout session.
 * @returns The `CheckoutView` component wrapped in a `HydrationBoundary` containing the prefetched query state.
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
  <HydrationBoundary state={dehydrate(queryClient)}>
    return <CheckoutView />;
  </HydrationBoundary>;
}