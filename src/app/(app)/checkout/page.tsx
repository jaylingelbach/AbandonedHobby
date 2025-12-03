import CheckoutView from '@/modules/checkout/ui/views/checkout-view';
import { CheckoutViewSkeleton } from '@/modules/checkout/ui/views/checkout-view-skeleton';

import { Suspense } from 'react';

/**
 * Render the checkout view for a Global checkout session.
 *
 * @returns A React element tree containing `CheckoutView` wrapped in `Suspense` with `CheckoutViewSkeleton` as the fallback.
 */

interface Props {
  searchParams?: Promise<{ cancel?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const wasCancelled = resolvedSearchParams?.cancel === 'true';
  return (
    <>
      {wasCancelled && (
        <div
          className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-4 py-3 text-sm"
          role="alert"
        >
          You cancelled checkout. No charges were made.
        </div>
      )}

      <Suspense fallback={<CheckoutViewSkeleton />}>
        <CheckoutView />
      </Suspense>
    </>
  );
}
