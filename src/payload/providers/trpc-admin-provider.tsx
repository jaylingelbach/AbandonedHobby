'use client';

import { TRPCReactProvider } from '@/trpc/client';
import type { ReactNode } from 'react';

export function TRPCAdminProvider({ children }: { children: ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}

export default TRPCAdminProvider;
