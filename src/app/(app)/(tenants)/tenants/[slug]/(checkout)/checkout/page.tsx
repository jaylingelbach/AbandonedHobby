// Legacy, now redirects to checkout
import { redirect } from 'next/navigation';

const Page = () => {
  redirect('/checkout');
};

export default Page;
