export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { headers as getHeaders } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';

// If your inbox UI is a client component:
import InboxClient from '@/modules/inbox/ui/inbox-client';
import { Suspense } from 'react';

/**
 * Server page for the inbox: verifies Payload session and renders the inbox UI or redirects to sign-in.
 *
 * Performs server-side authentication using Payload with the incoming request headers. If no authenticated user is found, redirects to `/sign-in?next=/inbox`. If authenticated, returns the inbox UI (InboxClient) wrapped in a Suspense boundary.
 *
 * @returns The React element for the inbox page.
 */
export default async function InboxPage() {
  // Authenticate against Payload using request headers (same as your tRPC ctx.db.auth)
  const payload = await getPayload({ config });
  const headers = await getHeaders();
  const session = await payload.auth({ headers });

  // No user -> redirect to sign-in (keep next so we return to /inbox after)
  if (!session?.user) {
    redirect(`/sign-in?next=/inbox`);
  }

  <Suspense>
    return <InboxClient /* userId={session.user.id} */ />;
  </Suspense>;
}
