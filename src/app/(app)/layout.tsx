import { DM_Sans } from 'next/font/google';
import type { Metadata } from 'next';
import { TRPCReactProvider } from '@/trpc/client';
import { Toaster } from '@/components/ui/sonner';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'Abandonded Hobbies',
  description:
    'A safe place for ADHD people to trade, buy and sell their hobbies judgement free'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.className} antialiased`}>
        <NuqsAdapter>
          <TRPCReactProvider>
            {children}
            <Toaster />
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
