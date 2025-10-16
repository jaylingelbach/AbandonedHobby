import type { ReactElement } from 'react';

export interface FaqItem {
  id: string;
  question: string;
  // Keep answers flexible for small rich fragments while still typed
  answer: string | ReactElement;
}

export interface Callout {
  id: string;
  title: string;
  body: string;
  icon: 'card' | 'wallet' | 'receipt';
  bgClass: string; // tailwind bg- color class (kept lean & typed as string)
}

export const faqItems: FaqItem[] = [
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
          Each sale has two kinds of fees, both deducted from the seller payout:
        </p>
        <ul className="list-disc pl-6">
          <li>
            <strong>Stripe payment processing</strong> — Stripe’s card
            processing fee, taken on the transaction.
          </li>
          <li>
            <strong>Abandoned Hobby marketplace fee</strong> — our small cut for
            running the platform.
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
          className="rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] bg-yellow-200 p-6 focus-within:outline-4 focus-within:outline-black"
          aria-describedby="fees-note"
        >
          <h4 className="text-lg font-bold">Illustrative breakdown</h4>
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
            Actual fees vary by card, country, and your current platform fee.
            Your dashboard shows exact amounts per order.
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
          Buyers get their money back; Stripe’s processing fees are generally
          not returned by Stripe. Our marketplace fee is refunded proportionally
          only when you choose to include it in the refund.
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
    question: 'Do international cards or currency conversion change the fees?',
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
            <strong>Abandoned Hobby</strong>: Order details page → fees and net
            payout.
          </li>
          <li>
            <strong>Stripe</strong>: Payments → select a payment → “Balance
            transactions”.
          </li>
        </ul>
      </div>
    )
  }
];

export const callouts: Callout[] = [
  {
    id: 'processing',
    title: 'Stripe Processing',
    body: 'Charged by Stripe on each transaction and deducted before payout to the seller.',
    icon: 'card',
    bgClass: 'bg-blue-200'
  },
  {
    id: 'marketplace',
    title: 'Marketplace Fee',
    body: 'A small percentage supporting hosting, security, support, and ongoing improvements.',
    icon: 'wallet',
    bgClass: 'bg-purple-200'
  },
  {
    id: 'breakdown',
    title: 'Clear Breakdown',
    body: 'See exact fees and net payouts in your order details and Stripe.',
    icon: 'receipt',
    bgClass: 'bg-red-200'
  }
];
