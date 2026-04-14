import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with your Abandoned Hobby account, orders, listings, and more.'
};

import SupportClient from './support-client';

/**
 * Render the Support page for the application.
 *
 * @returns A React element that renders the support client UI for the support route.
 */
export default function Page() {
  return <SupportClient />;
}
