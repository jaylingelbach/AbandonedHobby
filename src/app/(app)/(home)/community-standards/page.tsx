import type { Metadata } from 'next';
import CommunityStandardsClient from './community-standards-client';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Community Standards',
  description: 'Our community standards outline the expectations for all buyers and sellers on Abandoned Hobby, keeping the marketplace safe and welcoming for everyone.'
};

/**
 * Render the community standards client as the page content.
 *
 * @returns The JSX element for the community standards page.
 */
export default function CommunityStandardsPage() {
  return <CommunityStandardsClient />;
}
