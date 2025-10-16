'use client';

import { useMemo } from 'react';
import {
  CreditCard,
  Wallet,
  ReceiptText,
  HelpCircle,
  Calculator
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// ——— Types
interface FaqItem {
  id: string;
  question: string;
  answer: string | React.ReactElement;
}

// ——— Neo‑brutalist utility styles (kept inline for portability)
// Added strong focus states, reduced‑motion fallbacks, and color/contrast guards.
const nbCard = [
  'rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] bg-white p-6',
  'focus-within:outline focus-within:outline-4 focus-within:outline-black'
].join(' ');
const nbHeader = [
  'rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] p-6',
  'focus-within:outline focus-within:outline-4 focus-within:outline-black'
].join(' ');
const nbBadge = [
  'inline-block rounded-full border-4 border-black px-3 py-1 text-sm font-semibold shadow-[4px_4px_0_#000] bg-white'
].join(' ');
const nbButton = [
  'rounded-2xl border-4 border-black px-4 py-2 font-semibold shadow-[4px_4px_0_#000] bg-white',
  'transition-transform motion-reduce:transition-none hover:translate-x-[1px] hover:translate-y-[1px] motion-reduce:hover:transform-none',
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-black'
].join(' ');
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

function FaqSection() {
  const faq: FaqItem[] = useMemo(
    () => [
      {
        id: 'buyer-fees',
        question: 'Do buyers pay any extra Abandoned Hobby fees?',
        answer:
          'No. Buyers only pay the item price, shipping, and applicable taxes. We do not add a separate buyer service fee.'
      },
      {
        id: 'how-fees',
        question: 'How are fees handled on a sale?',
        answer: (
          <div className="space-y-2">
            <p>
              Each sale has two kinds of fees, both deducted from the seller
              payout:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Stripe payment processing</strong> — Stripe’s card
                processing fee, taken on the transaction.
              </li>
              <li>
                <strong>Abandoned Hobby marketplace fee</strong> — our small cut
                for running the platform.
              </li>
            </ul>
          </div>
        )
      },
      {
        id: 'who-pays-stripe',
        question: 'Who pays the Stripe processing fees?',
        answer:
          'Sellers do. Charges are processed directly on the seller’s connected Stripe account, and Stripe deducts its fee before payout.'
      },
      {
        id: 'platform-fee',
        question: "What is Abandoned Hobby's marketplace fee?",
        answer:
          'A small percentage of the order amount (tax excluded when applicable). It’s automatically deducted from the seller’s payout and shown in order details.'
      },
      {
        id: 'example',
        question: 'Example: how does a $100 sale break down?',
        answer: (
          <div className="grid gap-3">
            <div
              className={`${nbCard} bg-yellow-200`}
              aria-describedby="fees-note"
            >
              <div className="flex items-center gap-3">
                <Calculator className="size-5" aria-hidden="true" />
                <h4 className="text-lg font-bold">Illustrative breakdown</h4>
              </div>
              <ul className="mt-3 space-y-1">
                <li>
                  Order total: <strong>$100.00</strong>
                </li>
                <li>
                  Stripe processing (example): <strong>~$3.20</strong>
                </li>
                <li>
                  Abandoned Hobby fee (example 10%): <strong>$10.00</strong>
                </li>
                <li>
                  Seller receives: <strong>$86.80</strong>
                </li>
              </ul>
              <p id="fees-note" className="mt-2 text-sm opacity-90">
                Actual fees vary by card, country, and your current platform
                fee. Your dashboard shows exact amounts per order.
              </p>
            </div>
          </div>
        )
      },
      {
        id: 'payouts',
        question: 'When do sellers get paid out?',
        answer:
          'Payout timing follows Stripe’s standard schedule for your country and bank. Check Stripe → Balance → Payouts for upcoming and completed payouts.'
      },
      {
        id: 'refunds',
        question: 'What happens if I refund an order?',
        answer: (
          <div>
            <p>
              Sellers initiate refunds. The buyer receives their money back;
              Stripe’s processing fees are generally not returned by Stripe. Our
              marketplace fee is refunded proportionally only when you choose to
              include it in the refund.
            </p>
            <p className="mt-2 text-sm opacity-90">
              Partial refunds prorate fees accordingly.
            </p>
          </div>
        )
      },
      {
        id: 'disputes',
        question: 'Who handles disputes/chargebacks?',
        answer:
          'Because charges are on the seller’s Stripe account, the seller owns disputes. Stripe will notify you and guide evidence submission. If a dispute is lost, Stripe debits the seller’s balance.'
      },
      {
        id: 'intl',
        question:
          'Do international cards or currency conversion change the fees?',
        answer:
          'They can. Stripe’s pricing varies by card, region, and currency conversion. Your Stripe dashboard shows the exact fee per charge.'
      },
      {
        id: 'where-see',
        question: 'Where can I see a clear breakdown per order?',
        answer: (
          <div>
            <p className="mb-2">Check both places for full detail:</p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Abandoned Hobby</strong>: Order details page → fees and
                net payout.
              </li>
              <li>
                <strong>Stripe</strong>: Payments → select a payment → “Balance
                transactions”.
              </li>
            </ul>
          </div>
        )
      }
    ],
    []
  );

  return (
    <section aria-labelledby="faq-heading" className="space-y-4">
      <h2 id="faq-heading" className="text-2xl font-extrabold tracking-tight">
        Fees & Payouts — FAQ
      </h2>
      <div className="grid gap-4">
        {faq.map((item) => (
          <details
            key={item.id}
            className={`${nbCard} bg-pink-200 open:bg-pink-300 transition-colors motion-reduce:transition-none`}
          >
            {/* Ensure the summary is keyboard navigable and clearly styled */}
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
            Transparent, seller‑friendly pricing. Buyers pay exactly what they
            see; sellers see a clear breakdown on every order.
          </p>
        </div>
        <div className="flex gap-3" aria-label="Page highlights">
          <span className={nbBadge}>No buyer fee</span>
          <span className={`${nbBadge} bg-orange-300`}>Seller‑friendly</span>
        </div>
      </div>
    </header>
  );
}

function Callouts() {
  return (
    <section
      className="grid gap-4 md:grid-cols-3"
      aria-labelledby="callouts-heading"
    >
      <h2 id="callouts-heading" className={srOnly}>
        Key points
      </h2>
      <div className={`${nbCard} bg-blue-200`}>
        <div className="flex items-center gap-3">
          <CreditCard className="size-5" aria-hidden="true" />
          <h3 className="text-lg font-bold">Stripe Processing</h3>
        </div>
        <p className="mt-2 text-sm">
          Charged by Stripe on each transaction and deducted before payout to
          the seller.
        </p>
      </div>
      <div className={`${nbCard} bg-purple-200`}>
        <div className="flex items-center gap-3">
          <Wallet className="size-5" aria-hidden="true" />
          <h3 className="text-lg font-bold">Marketplace Fee</h3>
        </div>
        <p className="mt-2 text-sm">
          A small percentage supporting hosting, security, support, and ongoing
          improvements.
        </p>
      </div>
      <div className={`${nbCard} bg-red-200`}>
        <div className="flex items-center gap-3">
          <ReceiptText className="size-5" aria-hidden="true" />
          <h3 className="text-lg font-bold">Clear Breakdown</h3>
        </div>
        <p className="mt-2 text-sm">
          See exact fees and net payouts in your order details and Stripe.
        </p>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        className="mx-auto max-w-4xl space-y-6 p-4 md:p-8"
        aria-labelledby="page-title"
      >
        <Hero />
        <Callouts />
        <Tldr />
        <FaqSection />
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
