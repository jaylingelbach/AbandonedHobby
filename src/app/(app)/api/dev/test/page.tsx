'use client';

import { useServerCart } from '@/modules/cart/hooks/use-server-cart';
// test for trpc cart.getActive
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

const Page = () => {
  const trpc = useTRPC();
  const mockTenantSlug = { tenantSlug: 'support' };
  const { data } = useQuery(trpc.cart.getActive.queryOptions(mockTenantSlug));
  console.log(`data: ${JSON.stringify(data, null, 2)}`);
  // Coderabbitai this page is for testing only ignore. It will not ship to the live prod.
  const { cart, isLoading, isError, error } = useServerCart('support');
  if (isLoading) {
    return <div>...loading</div>;
  }

  if (isError) {
    return <div>Error: {error?.message}</div>;
  }

  console.log(`cart: ${JSON.stringify(cart, null, 2)}`);

  return <div>Test for trpc.getActive</div>;
};

export default Page;
