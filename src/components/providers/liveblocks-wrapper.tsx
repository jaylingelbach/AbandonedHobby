// src/components/providers/LiveblocksWrapper.tsx
'use client';

import { LiveblocksProvider } from '@liveblocks/react';

export function LiveblocksWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      {children}
    </LiveblocksProvider>
  );
}
