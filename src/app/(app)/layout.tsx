import { DM_Sans } from 'next/font/google';

import type { Metadata } from 'next';

import { TRPCReactProvider } from '@/trpc/client';
import { Toaster } from '@/components/ui/sonner';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import './globals.css';
import { AnalyticsIdentityBridge } from '@/components/analytics/analytics-identity-bridge'; // client
import { LiveblocksWrapper } from '@/components/providers/liveblocks-wrapper';

import PostHogInit from './posthog-init'; // client
import { CookieConsentBanner } from '@/components/analytics/cookie-consent-banner'; // client

const dmSans = DM_Sans({ subsets: ['latin'] });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.abandonedhobby.com';

const keywords = [
  'abandoned hobbies',
  'hobby marketplace',
  'buy and sell hobby gear',
  'used hobby equipment',
  'creative hobbies',
  'DIY hobbies',
  'craft supplies marketplace',
  'maker community',
  'secondhand hobby supplies',
  'unfinished projects'
];

const intentKeywords = [
  'sell unused hobby supplies',
  'buy cheap hobby gear',
  'where to sell craft supplies',
  'marketplace for handmade tools',
  'resell hobby equipment',
  'declutter hobby materials',
  'find affordable craft tools'
];

const longTailKeywords = [
  'what to do with abandoned hobbies',
  'sell unfinished craft projects online',
  'buy secondhand art supplies cheap',
  'marketplace for hobbyists and makers',
  'unused hobby gear resale platform',
  'creative hobby supply exchange'
];

const brandKeywords = [
  'Abandoned Hobby',
  'Abandoned Hobby marketplace',
  'Abandoned Hobby app'
];

export const metadata: Metadata = {
  metadataBase: (() => {
    const fallbackUrl = 'https://www.abandonedhobby.com';
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? fallbackUrl);
    } catch {
      return new URL(fallbackUrl);
    }
  })(),
  title: {
    default: 'Abandoned Hobby',
    template: '%s | Abandoned Hobby'
  },
  icons: { icon: '/favicon.ico' },
  description:
    'Turn unfinished projects into opportunity. Buy and sell unused hobby gear, craft supplies, and creative tools.',
  keywords: [
    ...keywords,
    ...intentKeywords,
    ...longTailKeywords,
    ...brandKeywords
  ],
  openGraph: {
    title: 'Abandoned Hobby',
    description:
      'Turn unfinished projects into opportunity. Buy and sell unused hobby gear, craft supplies, and creative tools.',
    url: siteUrl,
    siteName: 'Abandoned Hobby',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/open-graph-image.png',
        width: 1200,
        height: 630,
        alt: 'Abandoned Hobby'
      }
    ]
  }
};

/**
 * Renders the application's root HTML structure, applies the global font class to <body>, and wraps `children` with app-level providers and utilities.
 *
 * @param children - The page or application content to render inside the global layout
 * @returns The root HTML and body elements containing `children` wrapped by global providers and utilities
 */
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.className} antialiased`}>
        <PostHogInit />
        <CookieConsentBanner />
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
