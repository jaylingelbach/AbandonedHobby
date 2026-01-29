import CommunityStandardsClient from './community-standards-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Render the community standards client as the page content.
 *
 * @returns The JSX element for the community standards page.
 */
export default function CommunityStandardsPage() {
  return <CommunityStandardsClient />;
}