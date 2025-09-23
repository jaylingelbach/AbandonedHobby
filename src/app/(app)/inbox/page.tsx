export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { headers as getHeaders } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';

// If your inbox UI is a client component:
import InboxClient from '@/modules/inbox/ui/inbox-client';

export default async function InboxPage() {
  // Authenticate against Payload using request headers (same as your tRPC ctx.db.auth)
  const payload = await getPayload({ config });
  const headers = await getHeaders();
  const session = await payload.auth({ headers });

  // No user -> redirect to sign-in (keep next so we return to /inbox after)
  if (!session?.user) {
    redirect(`/sign-in?next=/inbox`);
  }

  // You can pass whatever you need down (e.g., user id/email)
  return <InboxClient /* userId={session.user.id} */ />;
}
