import { caller } from '@/trpc/server';

import SignInView from '@/modules/auth/ui/views/sign-in-view';

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const Page = async () => {
  try {
    const session = await caller.auth.session();
    if (session.user) {
      redirect('/');
    }
  } catch (error) {
    console.error('Failed to fetch session', error);
  }
  return <SignInView />;
};

export default Page;
