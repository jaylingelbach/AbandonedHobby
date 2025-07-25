// src/app/(app)/layout.tsx
import { DM_Sans } from 'next/font/google';
import type { Metadata } from 'next';
import { TRPCReactProvider } from '@/trpc/client';
import { Toaster } from '@/components/ui/sonner';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import './globals.css';
import { LiveblocksWrapper } from '@/components/providers/liveblocks-wrapper';

const dmSans = DM_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Abandoned Hobby',
  icons: { icon: '/favicon.ico' },
  description:
    'A safe place for ADHD people to trade, buy and sell their hobbies judgement free'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.className} antialiased`}>
        <NuqsAdapter>
          <TRPCReactProvider>
            {/* ✔️ This is a client component. */}
            <LiveblocksWrapper>{children}</LiveblocksWrapper>
            <Toaster />
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
