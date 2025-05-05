'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

export default function Home() {
  const trcp = useTRPC();
  const { data } = useQuery(trcp.auth.session.queryOptions());
  return <div>{JSON.stringify(data?.user, null, 2)}</div>;
}
