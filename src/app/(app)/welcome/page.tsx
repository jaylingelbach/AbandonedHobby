import type { Metadata } from 'next';

import WelcomeClient from './welcome-client';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <WelcomeClient />;
}
