import CheckoutView from '@/modules/checkout/ui/views/checkout-view';
import { trpc, getQueryClient } from '@/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { SearchParams } from 'nuqs';

// Global checkout not tenant specific
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
