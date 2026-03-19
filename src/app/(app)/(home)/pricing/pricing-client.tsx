'use client';

import Link from 'next/link';
import { faqItems, callouts } from './pricing-content';

import {
  CalloutsSection,
  FaqSection,
  Hero,
  Tldr,
  nbButton
} from '@/app/(app)/(home)/pricing/pricing-sections';

function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute left-2 top-2 z-50 -translate-y-16 rounded-md bg-yellow-300 px-3 py-2 text-sm font-semibold border-4 border-black shadow-[4px_4px_0_#000] focus:translate-y-0 focus:outline-none"
    >
      Skip to content
    </a>
  );
}

export function PricingClient() {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        className="mx-auto max-w-4xl space-y-6 p-4 md:p-8"
        aria-labelledby="page-title"
      >
        <Hero />
        <CalloutsSection items={callouts} />
        <Tldr />
        <FaqSection items={faqItems} />
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Need help with fees or payouts?</p>
          <div className="flex gap-3">
            <Link href="/support" className={nbButton}>
              Visit Support
            </Link>
            <Link href="/terms" className={`${nbButton} bg-yellow-200`}>
              Read Terms
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
