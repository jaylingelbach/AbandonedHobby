import { redirect } from 'next/navigation';

import { caller } from '@/trpc/server';
import ModerationInboxPage from './moderation-inbox-client';

export default async function Page() {
  try {
    const session = await caller.auth.session();
    if (!session.user) redirect('/sign-in?next=/staff/moderation');
  } catch {
    redirect('/sign-in?next=/staff/moderation');
  }

  return <ModerationInboxPage />;
}
