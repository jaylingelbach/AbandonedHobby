import type { ReactElement } from 'react';

export interface TermsSection {
  id: string;
  heading: string;
  body: string | ReactElement;
}

export const LAST_UPDATED = 'October 16, 2025';

export const sections: TermsSection[] = [
  {
    id: 'intro',
    heading: 'Introduction',
    body: (
      <p>
        These Terms and Conditions (“Terms”) govern your access to and use of
        Abandoned Hobby (the “Platform”). By accessing or using the Platform,
        you agree to be bound by these Terms and our Privacy Policy. If you do
        not agree, do not use the Platform.
      </p>
    )
  },
  {
    id: 'definitions',
    heading: 'Definitions',
    body: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Buyer</strong>: A user who purchases items on the Platform.
        </li>
        <li>
          <strong>Seller</strong>: A user who lists and sells items via a
          connected Stripe account.
        </li>
        <li>
          <strong>Content</strong>: Listings, text, images, and other materials
          posted to the Platform.
        </li>
      </ul>
    )
  },
  {
    id: 'accounts',
    heading: 'Accounts & Eligibility',
    body: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          You must be at least 18 years old and able to form a binding contract.
        </li>
        <li>
          You are responsible for safeguarding your credentials and for all
          activity under your account.
        </li>
        <li>Provide accurate information and keep it up to date.</li>
      </ul>
    )
  },
  {
    id: 'marketplace-role',
    heading: 'Marketplace Role',
    body: (
      <p>
        Abandoned Hobby provides a venue for Buyers and Sellers. We do not own,
        create, or manufacture items listed by Sellers and do not guarantee
        quality, safety, legality, or fitness for a particular purpose.
        Transactions occur between Buyer and Seller.
      </p>
    )
  },
  {
    id: 'payments-fees',
    heading: 'Payments & Fees',
    body: (
      <div className="space-y-2">
        <p>
          Payments are processed via the Seller’s connected Stripe account.
          Stripe charges its own processing fees. Abandoned Hobby may charge a
          marketplace fee which is deducted from the Seller’s payout. See our{' '}
          <a className="underline" href="/pricing">
            Pricing & Fees
          </a>{' '}
          page for details.
        </p>
        <p>
          By selling on the Platform, you authorize Abandoned Hobby and Stripe
          to deduct applicable fees from each transaction and to settle net
          proceeds to your connected account per Stripe’s payout schedule.
        </p>
      </div>
    )
  },
  {
    id: 'seller-obligations',
    heading: 'Seller Obligations',
    body: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Complete Stripe onboarding and maintain good standing with Stripe.
        </li>
        <li>Accurately describe items and pricing; honor orders you accept.</li>
        <li>Comply with applicable laws, taxes, and shipping obligations.</li>
        <li>
          Provide timely customer support and resolve disputes in good faith.
        </li>
      </ul>
    )
  },
  {
    id: 'prohibited-items',
    heading: 'Prohibited Items & Conduct',
    body: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Illegal items, stolen goods, counterfeit items, or items that infringe
          IP rights.
        </li>
        <li>Hazardous materials or items prohibited by carrier or law.</li>
        <li>
          Fraud, abusive behavior, or attempts to manipulate fees or ratings.
        </li>
      </ul>
    )
  },
  {
    id: 'shipping-returns',
    heading: 'Shipping, Returns & Refunds',
    body: (
      <p>
        Sellers are responsible for shipping and delivery. Return and refund
        policies are set by the Seller and must be clearly disclosed on the
        listing. Refunds are processed via Stripe. Stripe processing fees are
        generally not returned; Abandoned Hobby’s fee may be refunded at the
        Seller’s discretion and only as permitted by Platform tools.
      </p>
    )
  },
  {
    id: 'disputes',
    heading: 'Disputes & Chargebacks',
    body: (
      <p>
        Disputes and chargebacks are owned by the Seller’s Stripe account.
        Stripe may debit the Seller for lost disputes. Abandoned Hobby may
        assist with guidance but is not a party to the dispute. Provide accurate
        records and tracking to improve outcomes.
      </p>
    )
  },
  {
    id: 'ip',
    heading: 'Intellectual Property',
    body: (
      <p>
        You retain ownership of your Content but grant Abandoned Hobby a
        non-exclusive, worldwide, royalty-free license to host, display, and
        distribute it for Platform operation and promotion. You represent you
        have rights to the Content you post.
      </p>
    )
  },
  {
    id: 'privacy',
    heading: 'Privacy',
    body: (
      <p>
        Your use of the Platform is subject to our Privacy Policy, which
        explains how we collect, use, and share information.
      </p>
    )
  },
  {
    id: 'third-parties',
    heading: 'Third-Party Services',
    body: (
      <p>
        We integrate with third-party services (e.g., Stripe). Your use of those
        services may be subject to their terms and policies. We are not
        responsible for third-party acts or omissions.
      </p>
    )
  },
  {
    id: 'termination',
    heading: 'Suspension & Termination',
    body: (
      <p>
        We may suspend or terminate access, remove listings, or restrict
        features if we believe a user has violated these Terms, engaged in
        fraud, or created risk to the Platform or users.
      </p>
    )
  },
  {
    id: 'changes',
    heading: 'Changes to the Terms',
    body: (
      <p>
        We may update these Terms from time to time. Continued use after changes
        become effective constitutes acceptance of the revised Terms. We will
        update the “Last updated” date below.
      </p>
    )
  },
  {
    id: 'governing-law',
    heading: 'Governing Law',
    body: (
      <p>
        These Terms are governed by the laws of the State of Illinois, without
        regard to its conflict of laws principles. Venue and jurisdiction lie in
        the courts located in Illinois, USA.
      </p>
    )
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: (
      <p>
        Questions about these Terms? Email us at{' '}
        <a className="underline" href="mailto:support@abandonedhobby.com">
          support@abandonedhobby.com
        </a>
        .
      </p>
    )
  }
  //   {
  //     id: 'disclaimer',
  //     heading: 'Disclaimer (Not Legal Advice)',
  //     body: (
  //       <p>
  //         This page provides general information and does not constitute legal
  //         advice. Consult an attorney to ensure these Terms meet your specific
  //         needs and legal obligations.
  //       </p>
  //     )
  //   }
];
