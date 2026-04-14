import type { Metadata } from 'next';

import StripeVerifyClient from './stripe-verify-client';

export const metadata: Metadata = { robots: { index: false } };

/**
 * Page component that renders the Stripe verification client UI.
 *
 * @returns The page's React element which mounts the `StripeVerifyClient` component.
 */
export default function Page() {
  return <StripeVerifyClient />;
}
