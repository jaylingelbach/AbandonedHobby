import type { Metadata } from 'next';

import WelcomeClient from './welcome-client';

export const metadata: Metadata = { robots: { index: false } };

/**
 * Render the welcome client page.
 *
 * @returns The root JSX element for the welcome page that renders the WelcomeClient component.
 */
export default function Page() {
  return <WelcomeClient />;
}
