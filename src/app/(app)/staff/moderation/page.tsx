import type { Metadata } from 'next';
import { TRPCError } from '@trpc/server';

export const metadata: Metadata = { robots: { index: false } };
import { redirect } from 'next/navigation';

import { caller } from '@/trpc/server';
import ModerationInboxPage from './moderation-inbox-client';

/**
 * Server-side page that enforces authentication and renders the moderation inbox.
 *
 * If the user is not authenticated, redirects to `/sign-in?next=/staff/moderation`.
 *
 * @returns A React element rendering the moderation inbox page.
 * @throws Re-throws unexpected errors encountered while fetching the session so the error boundary can handle them.
 */
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
