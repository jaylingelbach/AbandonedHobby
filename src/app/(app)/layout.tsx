import { DM_Sans } from 'next/font/google';
import type { Metadata } from 'next';
import { TRPCReactProvider } from '@/trpc/client';
import { Toaster } from '@/components/ui/sonner';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import './globals.css';
import { LiveblocksWrapper } from '@/components/providers/liveblocks-wrapper';
import PostHogInit from './posthog-init'; // client
import { AnalyticsIdentityBridge } from '@/components/analytics/analytics-identity-bridge'; // client

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
        <PostHogInit />
        <NuqsAdapter>
          <TRPCReactProvider>
            <AnalyticsIdentityBridge />
            <LiveblocksWrapper>{children}</LiveblocksWrapper>
            <Toaster />
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
