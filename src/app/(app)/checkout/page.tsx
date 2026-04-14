import type { Metadata } from 'next';

import CheckoutView from '@/modules/checkout/ui/views/checkout-view';

export const metadata: Metadata = { robots: { index: false } };
import { CheckoutViewSkeleton } from '@/modules/checkout/ui/views/checkout-view-skeleton';

import { Suspense } from 'react';

/**
 * Render the checkout view for a Global checkout session.
 * @returns A React element tree containing `CheckoutView` wrapped in `Suspense` with `CheckoutViewSkeleton` as the fallback.
 */

export default async function Page() {
  return (
    <Suspense fallback={<CheckoutViewSkeleton />}>
      <CheckoutView />
    </Suspense>
  );
}
