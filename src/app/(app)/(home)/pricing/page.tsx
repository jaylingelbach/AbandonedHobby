import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for buyers and sellers on Abandoned Hobby. No hidden fees.'
};

import { PricingClient } from './pricing-client';

export default function Page() {
  return <PricingClient />;
}
