import CheckoutView from '@/modules/checkout/ui/views/checkout-view';
import { CheckoutViewSkeleton } from '@/modules/checkout/ui/views/checkout-view-skeleton';

import { Suspense } from 'react';

/**
 * Server page that renders the checkout view for a Global checkout session.
 * @returns The `CheckoutView` component wrapped in a `Suspense`.
 */

export default function Page() {
  return (
    <Suspense fallback={<CheckoutViewSkeleton />}>
      <CheckoutView />
    </Suspense>
  );
}
