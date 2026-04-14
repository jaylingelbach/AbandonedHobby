import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with your Abandoned Hobby account, orders, listings, and more.'
};

import SupportClient from './support-client';

export default function Page() {
  return <SupportClient />;
}
