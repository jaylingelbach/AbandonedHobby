import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Discover what Abandoned Hobby offers — listings, messaging, secure checkout, and a community built for hobbyists.'
};

/**
 * Renders the Features page content.
 *
 * @returns The React element for the Features page.
 */
function Page() {
  return <div>Features</div>;
}

export default Page;
