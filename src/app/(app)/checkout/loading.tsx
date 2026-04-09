import { CheckoutViewSkeleton } from '@/modules/checkout/ui/views/checkout-view-skeleton';

/**
 * Renders the checkout view skeleton shown while the checkout route is loading.
 *
 * @returns A React element containing the checkout view skeleton component.
 */
export default function Loading() {
  return <CheckoutViewSkeleton />;
}
