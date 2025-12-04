'use client';

// test for trpc cart.getActive
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

const Page = () => {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.cart.getActive.queryOptions({ tenantSlug: 'support' })
  );

  return <div>Test for trpc.getActive</div>;
};

export default Page;
