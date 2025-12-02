// Legacy, now redirects to checkout
import { redirect } from 'next/navigation';

const Page = async () => {
  redirect('/checkout');
};

export default Page;
