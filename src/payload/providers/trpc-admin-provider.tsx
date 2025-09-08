'use client';

import { TRPCReactProvider } from '@/trpc/client';

export function TRPCAdminProvider({ children }: { children: React.ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}

export default TRPCAdminProvider;
