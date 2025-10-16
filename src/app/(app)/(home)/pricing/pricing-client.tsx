'use client';

import Link from 'next/link';
import { CreditCard, Wallet, ReceiptText, HelpCircle } from 'lucide-react';
import {
  faqItems,
  callouts,
  type FaqItem,
  type Callout
} from './pricing-content';

const nbCard =
  'rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] bg-white p-6 focus-within:outline focus-within:outline-4 focus-within:outline-black';
const nbHeader =
  'rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] p-6 focus-within:outline focus-within:outline-4 focus-within:outline-black';
const nbBadge =
  'inline-block rounded-full border-4 border-black px-3 py-1 text-sm font-semibold shadow-[4px_4px_0_#000] bg-white';
const nbButton =
  'rounded-2xl border-4 border-black px-4 py-2 font-semibold shadow-[4px_4px_0_#000] bg-white transition-transform motion-reduce:transition-none hover:translate-x-[1px] hover:translate-y-[1px] motion-reduce:hover:transform-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-black';
const srOnly = 'sr-only';

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

function IconFromKey({ keyName }: { keyName: Callout['icon'] }) {
  if (keyName === 'card')
    return <CreditCard className="size-5" aria-hidden="true" />;
  if (keyName === 'wallet')
    return <Wallet className="size-5" aria-hidden="true" />;
  return <ReceiptText className="size-5" aria-hidden="true" />;
}

function CalloutsSection({ items }: { items: Callout[] }) {
  return (
    <section
      className="grid gap-4 md:grid-cols-3"
      aria-labelledby="callouts-heading"
    >
      <h2 id="callouts-heading" className={srOnly}>
        Key points
      </h2>
      {items.map((c) => (
        <div key={c.id} className={`${nbCard} ${c.bgClass}`}>
          <div className="flex items-center gap-3">
            <IconFromKey keyName={c.icon} />
            <h3 className="text-lg font-bold">{c.title}</h3>
          </div>
          <p className="mt-2 text-sm">{c.body}</p>
        </div>
      ))}
    </section>
  );
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section aria-labelledby="faq-heading" className="space-y-4">
      <h2 id="faq-heading" className="text-2xl font-extrabold tracking-tight">
        Fees & Payouts — FAQ
      </h2>
      <div className="grid gap-4">
        {items.map((item) => (
          <details
            key={item.id}
            className={`${nbCard} bg-pink-200 open:bg-pink-300 transition-colors motion-reduce:transition-none`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 focus:outline-none focus-visible:outline-4 focus-visible:outline-black">
              <div className="flex items-center gap-3">
                <HelpCircle className="size-5" aria-hidden="true" />
                <span className="text-lg font-bold">{item.question}</span>
              </div>
              <span className={nbBadge} aria-hidden="true">
                FAQ
              </span>
            </summary>
            <div className="mt-4 text-base leading-relaxed">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Tldr() {
  return (
    <section
      className={`${nbCard} bg-green-200`}
      aria-labelledby="tldr-heading"
    >
      <h2 id="tldr-heading" className="text-xl font-extrabold">
        Quick TL;DR
      </h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>Buyers don’t pay extra platform fees.</li>
        <li>
          Sellers pay Stripe processing + a small Abandoned Hobby fee (both
          deducted from payout).
        </li>
        <li>
          Refunds: Stripe usually keeps processing fees; our fee can be refunded
          if you choose.
        </li>
        <li>Disputes are handled by the seller’s Stripe account.</li>
      </ul>
    </section>
  );
}

function Hero() {
  return (
    <header className={`${nbHeader} bg-yellow-300`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Pricing & Fees
          </h1>
          <p className="mt-1 max-w-prose text-base">
            Transparent, seller-friendly pricing. Buyers pay exactly what they
            see; sellers see a clear breakdown on every order.
          </p>
        </div>
        <div className="flex gap-3" aria-label="Page highlights">
          <span className={nbBadge}>No buyer fee</span>
          <span className={`${nbBadge} bg-orange-300`}>Seller-friendly</span>
        </div>
      </div>
    </header>
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
        <h1 id="page-title" className="sr-only">
          Pricing & Fees
        </h1>
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
