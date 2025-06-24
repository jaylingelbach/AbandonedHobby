'use client';

import { LiveblocksProvider } from '@liveblocks/react';

export function LiveblocksWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      publicApiKey={process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!}
    >
      {children}
    </LiveblocksProvider>
  );
}
