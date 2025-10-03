import { redirect } from 'next/navigation';
import SignInView from '@/modules/auth/ui/views/sign-in-view';
import { caller } from '@/trpc/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await caller.auth.session();
  if (session?.user) {
    redirect('/'); // throws; do not catch
  }
  return <SignInView />;
}
