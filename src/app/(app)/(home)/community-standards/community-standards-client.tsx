'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import {
  HeartHandshake,
  ShieldCheck,
  ScrollText,
  AlertTriangle,
  Ban,
  Scale,
  BadgeCheck,
  Lock,
  Gavel,
  Flag
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type JumpLink = { id: string; label: string };

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  content: React.ReactNode;
};

export default function CommunityStandardsClient() {
  const lastUpdatedDate = '2026-01-29';
  const lastUpdatedText = 'January 29, 2026';

  const jumpLinks: JumpLink[] = useMemo(
    () => [
      {
        id: 'if-your-listing-was-removed',
        label: 'If your listing was removed'
      },
      { id: 'prohibited-items', label: 'Prohibited items' },
      { id: 'restricted-items', label: 'Restricted items' },
      { id: 'accuracy-condition', label: 'Accuracy & condition' },
      { id: 'fraud-off-platform', label: 'Fraud & off-platform' },
      { id: 'harassment-hate', label: 'Harassment & hate' },
      { id: 'intellectual-property', label: 'Intellectual property' },
      { id: 'privacy-personal-info', label: 'Privacy & personal info' },
      { id: 'enforcement', label: 'Enforcement' },
      { id: 'appeals', label: 'Appeals' }
    ],
    []
  );

  const sections: Section[] = useMemo(
    () => [
      {
        id: 'baseline-expectations',
        title: 'Our baseline expectations',
        icon: ShieldCheck,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              We want listings and interactions that are:
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
              <li>
                <strong>Safe</strong> (no harm, threats, or illegal activity)
              </li>
              <li>
                <strong>Honest</strong> (accurate descriptions, real photos, no
                scams)
              </li>
              <li>
                <strong>Respectful</strong> (no harassment or hate)
              </li>
              <li>
                <strong>On-platform</strong> (payments + messages stay here so
                buyers/sellers are protected)
              </li>
            </ul>
          </>
        )
      },
      {
        id: 'if-your-listing-was-removed',
        title: 'If your listing was removed',
        icon: AlertTriangle,
        description:
          'What to do if you received a removal email or your listing disappears.',
        content: (
          <>
            <p className="text-sm leading-relaxed">
              If you received a removal email, it usually means the listing
              violated one of the standards below.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">What to do next</p>
              <ol className="mt-2 list-decimal pl-5 text-sm leading-relaxed">
                <li>
                  <strong>Find the category</strong> referenced in your email
                  (or match it below).
                </li>
                <li>
                  <strong>Fix the listing</strong> (photos, title, description,
                  category, or item itself).
                </li>
                <li>
                  <strong>Do not repost the same prohibited item</strong>—repeat
                  violations can lead to account restrictions.
                </li>
                <li>
                  If you think we made a mistake, submit an appeal (see{' '}
                  <a href="#appeals" className="underline">
                    Appeals
                  </a>
                  ).
                </li>
              </ol>
            </div>
          </>
        )
      },
      {
        id: 'generally-ok',
        title: 'What’s generally OK to list',
        icon: BadgeCheck,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              Most hobby-related items are welcome, including:
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
              <li>Instruments and music gear, pedals, parts, accessories</li>
              <li>
                Collectibles, toys, models, LEGO, board games, cards (authentic
                items only)
              </li>
              <li>Books, comics, zines, prints you’re allowed to sell</li>
              <li>Craft tools/materials that are legal and safe</li>
              <li>Used items (as long as condition is described accurately)</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              If your item is{' '}
              <strong>legal, safely shippable, and accurately described</strong>
              , it’s usually fine.
            </p>
          </>
        )
      },
      {
        id: 'prohibited-items',
        title: 'Prohibited items (not allowed)',
        icon: Ban,
        description:
          'Listings in these categories will be removed, even if they’re “for novelty” or “just a joke”.',
        content: (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem
              value="illegal"
              className="rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000]"
            >
              <AccordionTrigger className="text-left cursor-pointer">
                Illegal or regulated goods
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                <ul className="list-disc pl-5">
                  <li>
                    Illegal drugs or drug paraphernalia where prohibited by law
                  </li>
                  <li>Stolen goods or “found” items you can’t legally sell</li>
                  <li>
                    Counterfeit currency, forged documents, or “how-to” guides
                    for crime
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="weapons"
              className="mt-3 rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000]"
            >
              <AccordionTrigger className="text-left cursor-pointer">
                Weapons and weapon parts
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                <ul className="list-disc pl-5">
                  <li>Firearms, frames/receivers, ammunition</li>
                  <li>Silencers/suppressors, bump stocks, conversion parts</li>
                  <li>Explosives, bomb-making components, or instructions</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="hate"
              className="mt-3 rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000]"
            >
              <AccordionTrigger className="text-left cursor-pointer">
                Hate, harassment, or extremist content
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                <ul className="list-disc pl-5">
                  <li>Items that promote or glorify violence against people</li>
                  <li>Hate symbols or content targeting protected groups</li>
                  <li>Extremist propaganda or recruitment material</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="exploitation"
              className="mt-3 rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000]"
            >
              <AccordionTrigger className="text-left cursor-pointer">
                Sexual content involving minors or exploitation
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                <ul className="list-disc pl-5">
                  <li>
                    Any content involving minors in a sexual context (zero
                    tolerance)
                  </li>
                  <li>Non-consensual intimate content</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="selfharm"
              className="mt-3 rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000]"
            >
              <AccordionTrigger className="text-left cursor-pointer">
                Self-harm promotion
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                <ul className="list-disc pl-5">
                  <li>
                    Content that encourages or instructs self-harm or suicide
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="fraud"
              className="mt-3 rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000]"
            >
              <AccordionTrigger className="text-left cursor-pointer">
                Fraud / scams
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                <ul className="list-disc pl-5">
                  <li>
                    “Too good to be true” listings, fake giveaways, or
                    bait-and-switch
                  </li>
                  <li>
                    Anything designed to deceive buyers or manipulate
                    transactions
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      },
      {
        id: 'restricted-items',
        title: 'Restricted items (allowed only with strict rules)',
        icon: Scale,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              Some items are allowed <strong>only if</strong> they follow extra
              requirements. We may remove listings that are unclear, unsafe, or
              legally risky.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Examples (not exhaustive)</p>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                <li>
                  <strong>Knives / blades / replicas</strong>: must comply with
                  local laws; no “weapon” marketing
                </li>
                <li>
                  <strong>Alcohol / nicotine</strong>: typically not allowed in
                  many marketplaces; may be removed
                </li>
                <li>
                  <strong>Hazardous materials</strong>: flammables, corrosives,
                  pressurized containers (often not shippable)
                </li>
                <li>
                  <strong>Batteries</strong> (lithium): must follow carrier
                  rules; clearly disclose shipping limitations
                </li>
                <li>
                  <strong>Medical items</strong>: no prescription meds; no
                  claims that imply treatment/cures
                </li>
              </ul>
            </div>

            <p className="mt-3 text-sm leading-relaxed">
              If your item is restricted, your listing must be{' '}
              <strong>clear, legal, and safely shippable</strong>, and you must
              follow carrier + local rules.
            </p>
          </>
        )
      },
      {
        id: 'accuracy-condition',
        title: 'Accuracy and condition rules',
        icon: ScrollText,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              Listings must be truthful and complete.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
                <p className="text-sm font-black">You must</p>
                <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                  <li>
                    Use <strong>real photos</strong> of the actual item (not
                    stock images as the main photo)
                  </li>
                  <li>
                    Describe <strong>condition accurately</strong> (including
                    flaws, missing parts, damage)
                  </li>
                  <li>
                    Disclose what’s included (power supply, cables, case,
                    manuals, etc.)
                  </li>
                  <li>
                    Avoid misleading titles (no keyword stuffing, no “like new”
                    when it isn’t)
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
                <p className="text-sm font-black">Not allowed</p>
                <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                  <li>Misrepresenting brand/model</li>
                  <li>Hiding defects or “surprise” condition issues</li>
                  <li>
                    Listing something you don’t have in-hand (unless clearly
                    marked as a legitimate preorder with realistic timeline)
                  </li>
                </ul>
              </div>
            </div>
          </>
        )
      },
      {
        id: 'fraud-off-platform',
        title: 'Fraud, off-platform behavior, and manipulation',
        icon: Lock,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              To keep Buyer Protection intact, transactions and communication
              must stay on-platform.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Not allowed</p>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                <li>
                  Asking buyers to pay via Venmo, Cash App, Zelle, crypto, gift
                  cards, etc.
                </li>
                <li>
                  Posting contact info to move communication off-platform
                  (email, phone number, social handles)
                </li>
                <li>
                  “Fee avoidance” language (e.g., “message me to buy cheaper”)
                </li>
                <li>
                  Shill bidding, fake engagement, or coordinated manipulation
                </li>
              </ul>
            </div>

            <p className="mt-3 text-sm leading-relaxed">
              <strong>Why we enforce this:</strong> off-platform deals remove
              protection for both sides and create a high scam risk.
            </p>
          </>
        )
      },
      {
        id: 'harassment-hate',
        title: 'Harassment, hate, and unsafe interactions',
        icon: AlertTriangle,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              We don’t allow behavior that makes the community unsafe.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Not allowed</p>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                <li>Threats, intimidation, harassment, stalking</li>
                <li>Hate speech or slurs</li>
                <li>Doxxing or encouraging others to target someone</li>
                <li>Sexual harassment or unwanted explicit messages</li>
              </ul>
            </div>

            <p className="mt-3 text-sm leading-relaxed">
              Keep it respectful—even in disputes.
            </p>
          </>
        )
      },
      {
        id: 'intellectual-property',
        title: 'Intellectual property and counterfeit items',
        icon: Gavel,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              Respect creators and brands.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Not allowed</p>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                <li>Counterfeit goods or replicas presented as authentic</li>
                <li>
                  Unauthorized use of trademarks in a way that misleads buyers
                </li>
                <li>
                  Pirated digital goods, keys, cracked software, or illegal
                  downloads
                </li>
                <li>
                  Selling reproductions of someone else’s art/design without
                  permission
                </li>
              </ul>
            </div>

            <p className="mt-3 text-sm leading-relaxed">
              If you sell fan art or inspired work, make sure it’s{' '}
              <strong>clearly your original creation</strong> and not falsely
              branded as official.
            </p>
          </>
        )
      },
      {
        id: 'privacy-personal-info',
        title: 'Privacy and personal information',
        icon: Lock,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              Protect yourself and others.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Not allowed</p>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                <li>
                  Posting personal data: phone numbers, emails, addresses, ID
                  documents
                </li>
                <li>
                  Sharing private messages publicly without consent (especially
                  with personal info)
                </li>
                <li>Any attempt to expose (“dox”) someone</li>
              </ul>
            </div>

            <p className="mt-3 text-sm leading-relaxed">
              Use the in-app messaging system and let the platform handle
              disputes.
            </p>
          </>
        )
      },
      {
        id: 'enforcement',
        title: 'Enforcement: what happens when something violates standards',
        icon: Gavel,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              Depending on severity and history, we may take one or more of
              these actions:
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
              <li>
                <strong>Remove the listing</strong>
              </li>
              <li>
                <strong>Limit account features</strong> (listing limits,
                messaging restrictions)
              </li>
              <li>
                <strong>Temporary suspension</strong>
              </li>
              <li>
                <strong>Permanent removal from the platform</strong> (for severe
                or repeat violations)
              </li>
            </ul>

            <div className="mt-4 rounded-2xl border-4 border-black bg-yellow-200 p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Zero tolerance categories</p>
              <p className="mt-2 text-sm leading-relaxed">
                Some categories are <strong>zero tolerance</strong> (for
                example: exploitation, illegal weapons sales, child sexual
                content). Those can result in immediate account termination and
                reports to authorities where required.
              </p>
            </div>
          </>
        )
      },
      {
        id: 'appeals',
        title: 'Appeals',
        icon: ScrollText,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              If you believe a removal was incorrect, you can appeal.
            </p>

            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-4 shadow-[6px_6px_0_#000]">
              <p className="text-sm font-black">Include</p>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                <li>The listing title/ID (from the email)</li>
                <li>Why you think it follows standards</li>
                <li>
                  Any context that helps (clear photos, receipts/authentication,
                  corrected description)
                </li>
              </ul>
            </div>

            <p className="mt-3 text-sm leading-relaxed">
              We review appeals, but we may uphold removals when a listing is
              high-risk, unclear, or repeatedly violates the rules.
            </p>
          </>
        )
      },
      {
        id: 'reporting',
        title: 'Reporting something',
        icon: Flag,
        content: (
          <>
            <p className="text-sm leading-relaxed">
              If you see a listing or behavior that violates standards, please
              report it using the <strong>Report</strong> flow. Reports help us
              keep the marketplace safe and fair.
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              Thank you for helping keep Abandoned Hobby trustworthy.
            </p>
          </>
        )
      }
    ],
    []
  );

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (!hash) return;
      document
        .getElementById(hash)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  return (
    <main className="min-h-[100svh] bg-[#F4F4F0]">
      <section className="border-b-4 border-black">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12">
          <div className="nb-card rounded-3xl border-4 border-black bg-white p-6 shadow-[12px_12px_0_#000]">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <h1 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
                Community Standards
              </h1>
              <Badge className="border-2 border-black bg-black text-white">
                Marketplace
              </Badge>
            </div>

            <p className="mt-4 text-sm leading-relaxed">
              Abandoned Hobby is a marketplace for real people buying and
              selling hobby-related items. These standards explain what’s OK,
              what’s not, and what we do when something crosses the line.
            </p>

            <p className="mt-2 text-sm leading-relaxed">
              If you’re ever unsure whether a listing is allowed,{' '}
              <strong>don’t post it yet</strong>—reach out via{' '}
              <Link href="/support" className="underline">
                Support
              </Link>
              .
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <time
                dateTime={lastUpdatedDate}
                className="rounded-md border-2 border-black bg-yellow-200 px-2 py-1 text-xs font-black"
              >
                Last updated: {lastUpdatedText}
              </time>
              <span className="rounded-md border-2 border-black bg-sky-200 px-2 py-1 text-xs font-black">
                Linkable: /community-standards#section
              </span>
            </div>

            <Separator className="my-6 bg-black" />

            <div className="flex items-center gap-2">
              <div className="rounded-2xl border-4 border-black bg-white p-2 shadow-[4px_4px_0_#000]">
                <HeartHandshake className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="text-lg font-black">Quick jumps</h2>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {jumpLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="rounded-xl border-4 border-black bg-white px-3 py-2 text-xs font-black shadow-[6px_6px_0_#000] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[4px_4px_0_#000]"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6">
          {sections.map((section) => (
            <Card
              key={section.id}
              id={section.id}
              className={cn(
                'scroll-mt-24 rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]'
              )}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-xl font-black">
                  <div className="rounded-2xl border-4 border-black bg-white p-2 shadow-[4px_4px_0_#000]">
                    <section.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <span>{section.title}</span>
                </CardTitle>
                {section.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {section.description}
                  </p>
                ) : null}
              </CardHeader>

              <CardContent className="pt-0">{section.content}</CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-10 bg-black" />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Flag className="h-5 w-5" aria-hidden /> Need to report a
                listing?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              Use the report flow to flag items that violate standards.
              <div className="mt-3">
                <Link
                  href="/report"
                  className="inline-flex rounded-xl border-4 border-black bg-yellow-200 px-3 py-2 text-xs font-black shadow-[6px_6px_0_#000] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[4px_4px_0_#000]"
                >
                  Go to Report →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <ShieldCheck className="h-5 w-5" aria-hidden /> Still unsure?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              If you’re uncertain whether something is allowed, contact Support
              before posting.
              <div className="mt-3">
                <Link
                  href="/support"
                  className="inline-flex rounded-xl border-4 border-black bg-sky-200 px-3 py-2 text-xs font-black shadow-[6px_6px_0_#000] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[4px_4px_0_#000]"
                >
                  Go to Support →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
