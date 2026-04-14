import type { Metadata } from 'next';

import StripeVerifyClient from './stripe-verify-client';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <StripeVerifyClient />;
}
