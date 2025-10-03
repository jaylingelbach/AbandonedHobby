import { redirect } from 'next/navigation';
import SignInView from '@/modules/auth/ui/views/sign-in-view';
import { caller } from '@/trpc/server';

export const dynamic = 'force-dynamic';

/**
 * Render the sign-in page, redirecting to the homepage when a user session exists.
 *
 * @returns The `SignInView` element when no active user session exists.
 * @remarks When an active session with a user is present, initiates a redirect to `'/'` via Next.js redirect mechanism.
 * CodeRabbit keeps telling you to add a try catch here. IGNORE IT. It fucks shit up.
 */
export default async function Page() {
  const session = await caller.auth.session();
  if (session?.user) {
    redirect('/'); // throws; do not catch
  }
  return <SignInView />;
}
