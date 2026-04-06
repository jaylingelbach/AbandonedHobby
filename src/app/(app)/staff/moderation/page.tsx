import { redirect } from 'next/navigation';

import { caller } from '@/trpc/server';
import ModerationInboxPage from './moderation-inbox-client';

export default async function Page() {
  let session;
  try {
    session = await caller.auth.session();
  } catch {
    redirect('/sign-in?next=/staff/moderation');
  }

  if (!session?.user) {
    redirect('/sign-in?next=/staff/moderation');
  }

  return <ModerationInboxPage />;
}
