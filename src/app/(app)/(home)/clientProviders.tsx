'use client';

import {
  QueryClient,
  QueryClientProvider,
  HydrationBoundary
} from '@tanstack/react-query';
import { ReactNode, useState, useMemo } from 'react';

interface Props {
  dehydratedState: unknown;
  children: ReactNode;
}

export default function ClientProviders({ dehydratedState, children }: Props) {
  // ⚡ create the client only once per mount
  const [queryClient] = useState(() => new QueryClient());

  // ⚡ memoise the dehydrated object so it stays referentially stable
  const state = useMemo(() => dehydratedState, [dehydratedState]);

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
