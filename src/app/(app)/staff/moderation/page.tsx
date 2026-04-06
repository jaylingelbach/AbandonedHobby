import { TRPCError } from '@trpc/server';
import { redirect } from 'next/navigation';

import { caller } from '@/trpc/server';
import ModerationInboxPage from './moderation-inbox-client';

export default async function Page() {
  let session;
  try {
    session = await caller.auth.session();
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'UNAUTHORIZED') {
      redirect('/sign-in?next=/staff/moderation');
    }
    throw error; // Re-throw unexpected errors for error boundary
  }

  if (!session?.user) {
    redirect('/sign-in?next=/staff/moderation');
  }

  return <ModerationInboxPage />;
}
