import { redirect } from 'next/navigation';

import SignUpView from '@/modules/auth/ui/views/sign-up-view';
import { caller } from '@/trpc/server';


export const dynamic = 'force-dynamic';

const Page = async () => {
  const session = await caller.auth.session();
  try {
    if (session.user) {
      redirect('/');
    }
  } catch (error) {
    console.error('Failed to fetch the session: ', error);
  }
  return <SignUpView />;
};

export default Page;
