import CheckoutView from '@/modules/checkout/ui/views/checkout-view';
import { Suspense } from 'react';

/**
 * Server page that renders the checkout view for a Stripe session and hydrates prefetched order confirmation data.
 * @returns The `CheckoutView` component wrapped in a `HydrationBoundary` containing the prefetched query state.
 */

export default function Page() {
  return (
    <Suspense>
      <CheckoutView />
    </Suspense>
  );
}
