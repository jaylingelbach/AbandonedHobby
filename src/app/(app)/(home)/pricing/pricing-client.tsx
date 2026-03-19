'use client';

import Link from 'next/link';
import { faqItems, callouts } from './pricing-content';

import {
  CalloutsSection,
  FaqSection,
  Hero,
  Tldr
} from '@/app/(app)/(home)/pricing/pricing-sections';

const nbButton =
  'rounded-2xl border-4 border-black px-4 py-2 font-semibold shadow-[4px_4px_0_#000] bg-white transition-transform motion-reduce:transition-none hover:translate-x-[1px] hover:translate-y-[1px] motion-reduce:hover:transform-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-black';

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
