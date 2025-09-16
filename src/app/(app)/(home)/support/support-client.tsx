'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Truck,
  MessageSquare,
  RefreshCw,
  Flag,
  Lock,
  CheckCircle2,
  DollarSign,
  Bell
} from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import FaqCard from './components/faq-card';
import PolicyCard from './components/policy-card';
import SellerTipsCard from './components/seller-tips-card';
import SupportContactForm from './components/support-contact-form';
import { renderToText } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function SupportClient() {
  const [tab, setTab] = useState<'buyers' | 'sellers'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace('#', '');
      return h === 'sellers' ? 'sellers' : 'buyers';
    }
    return 'buyers';
  });

  // respond to external hash changes (e.g., clicking /support#sellers)
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'buyers' || h === 'sellers') setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // when user switches tabs, update the hash without jumping
  const handleTabChange = (value: string) => {
    const next = value === 'sellers' ? 'sellers' : 'buyers';
    if (typeof window !== 'undefined') {
      setTab(next);
      history.replaceState(null, '', `#${next}`);
      document
        .getElementById(next)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const actions = useMemo(
    () => [
      {
        label: 'Track my order',
        href: '/orders',
        icon: Truck,
        color: 'bg-amber-300'
      },
      {
        label: 'Contact the seller',
        href: '/orders',
        icon: MessageSquare,
        color: 'bg-emerald-300'
      },
      {
        label: 'Request a refund/return',
        href: '/orders',
        icon: RefreshCw,
        color: 'bg-cyan-300'
      },
      {
        label: 'Report a listing',
        href: '/report',
        icon: Flag,
        color: 'bg-rose-300'
      },
      {
        label: 'Reset my password',
        href: '/admin/forgot',
        icon: Lock,
        color: 'bg-violet-300'
      },
      {
        label: 'Verify seller account',
        href: '/stripe-verify',
        icon: CheckCircle2,
        color: 'bg-lime-300'
      },
      // {
      //   label: 'Set up payouts',
      //   href: '/dashboard/payouts',
      //   icon: Wallet,
      //   color: 'bg-sky-300'
      // },
      {
        label: 'Fees & taxes',
        href: '/support#policies',
        // href: 'policies',
        icon: DollarSign,
        color: 'bg-orange-300'
      },
      {
        label: 'Message center',
        href: '/inbox',
        icon: Bell,
        color: 'bg-yellow-300'
      }
    ],
    []
  );

  // --- FAQs
  const buyerFaqs = useMemo(
    () => [
      {
        q: 'How do I track my order?',
        a: (
          <>
            Go to <strong>Orders → Order details → Tracking</strong>. If there’s
            no tracking after <strong>3 business days</strong>, message the
            seller. No reply after <strong>48 hours</strong>? Escalate from the
            order page.
          </>
        )
      },
      {
        q: 'Returns & refunds',
        a: (
          <>
            Sellers must accept returns for damaged or not-as-described items.
            Start a return within <strong>7 days of delivery</strong> from your
            order page.
          </>
        )
      },
      {
        q: 'Contacting the seller',
        a: (
          <>
            Use <strong>Orders → Message seller</strong>. Keep chats on-platform
            so you’re covered by Buyer Protection.
          </>
        )
      },
      {
        q: 'Buyer Protection basics',
        a: (
          <>
            You’re covered when you pay on-platform and keep messages in-app. We
            can refund when there’s no tracking in 3 business days, SNAD on
            arrival, or seller no-response for 48+ hours.
          </>
        )
      },
      {
        q: 'Canceling an order',
        a: (
          <>
            Request cancellation before the seller ships. After tracking exists,
            use the return/refund flow.
          </>
        )
      }
    ],
    []
  );
  const sellerFaqs = useMemo(
    () => [
      {
        q: 'Get verified to sell (payouts)',
        a: (
          <>
            Complete verification with Stripe in{' '}
            <strong>Dashboard → Verify Account</strong>. You can’t list for sale
            until this is done.
          </>
        )
      },
      {
        q: 'When do I get paid?',
        a: (
          <>
            Payouts are handled by Stripe to your linked bank account. See
            <strong> Dashboard → Payouts</strong> for schedule and any holds.
          </>
        )
      },
      {
        q: 'Shipping & handling expectations',
        a: (
          <>
            Add tracking within <strong>3 business days</strong>. Pack securely
            and photograph condition before shipping.
          </>
        )
      },
      {
        q: 'Refunds & returns',
        a: (
          <>
            Cooperate on returns or partial refunds for damaged /
            not-as-described items. Issue refunds via{' '}
            <strong>Orders → Refund</strong>.
          </>
        )
      },
      {
        q: 'Fees',
        a: (
          <>
            Platform + processing fees are withheld before payout. See
            <strong> Dashboard → Payouts → Fees</strong>.
          </>
        )
      }
    ],
    []
  );

  // --- Simple local search (filters FAQs + actions by title)
  const [query, setQuery] = useState('');
  const searchable = useMemo(() => {
    const docs = [
      ...buyerFaqs.map((x) => ({
        type: 'Buyer FAQ',
        title: x.q,
        href: '#buyers'
      })),
      ...sellerFaqs.map((x) => ({
        type: 'Seller FAQ',
        title: x.q,
        href: '#sellers'
      })),
      ...actions.map((a) => ({ type: 'Action', title: a.label, href: a.href })),
      { type: 'Policy', title: 'Returns & Refunds Policy', href: '#policies' },
      { type: 'Policy', title: 'Buyer Protection', href: '#policies' },
      { type: 'Policy', title: 'Prohibited Items', href: '#policies' }
    ];
    if (!query) return docs.slice(0, 8);
    const q = query.toLowerCase();
    return docs.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 8);
  }, [query, actions, buyerFaqs, sellerFaqs]);

  // JSON-LD for FAQ rich results
  const faqJsonLd = useMemo(() => {
    const make = (items: { q: string; a: React.ReactNode }[]) =>
      items.map((i) => ({
        '@type': 'Question',
        name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: renderToText(i.a) }
      }));
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [...make(buyerFaqs), ...make(sellerFaqs)].slice(0, 12)
    } as const;
  }, [buyerFaqs, sellerFaqs]);

  return (
    <main className="min-h-[100svh] bg-[#F4F4F0]">
      {/* Hero */}
      <section className="border-b-4 border-black">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12">
          <div className="nb-card rounded-3xl border-4 border-black bg-white p-6 shadow-[12px_12px_0_#000]">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <h1 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
                How can we help?
              </h1>
              <Badge className="border-2 border-black bg-black text-white">
                Marketplace
              </Badge>
            </div>

            {/* Search */}
            <div className="mt-6">
              <label htmlFor="support-search" className="sr-only">
                Search support
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  id="support-search"
                  placeholder="Search orders, payouts, articles…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 rounded-2xl border-4 border-black pl-11 shadow-[8px_8px_0_#000] focus-visible:ring-0"
                />
              </div>
              {/* Suggestions */}
              {searchable.length > 0 && (
                <ul
                  aria-label="Search suggestions"
                  className="mt-3 grid gap-2 md:grid-cols-2"
                >
                  {searchable.map((s) => (
                    <li key={`${s.type}::${s.title}`}>
                      <Link href={s.href} className="group">
                        <div className="flex items-center justify-between rounded-xl border-4 border-black bg-white px-3 py-2 shadow-[6px_6px_0_#000] transition-transform group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[4px_4px_0_#000]">
                          <div className="truncate">
                            <span className="mr-2 rounded-md border-2 border-black bg-yellow-200 px-1 text-xs font-bold">
                              {s.type}
                            </span>
                            <span className="font-semibold">{s.title}</span>
                          </div>
                          <span aria-hidden>→</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-4 text-xl font-extrabold tracking-tight">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {actions.map((a) => (
            <Link key={a.label} href={a.href} className="group">
              <Card
                className={`rounded-3xl border-4 border-black ${a.color} transition-transform shadow-[10px_10px_0_#000] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[8px_8px_0_#000]`}
              >
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-2xl border-4 border-black bg-white p-2 shadow-[4px_4px_0_#000]">
                    <a.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base font-black">
                    {a.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm font-medium">
                  Go
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Buyers / Sellers segmented */}
      <section id="audiences" className="mx-auto max-w-6xl px-4 pb-10">
        <Tabs
          defaultValue={tab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="cursor-pointer mb-6 grid w-full grid-cols-2 rounded-2xl border-4 border-black bg-white p-1 shadow-[6px_6px_0_#000]">
            <TabsTrigger
              value="buyers"
              className="data-[state=active]:bg-yellow-200 data-[state=active]:shadow-[4px_4px_0_#000] cursor-pointer"
            >
              Buyers
            </TabsTrigger>
            <TabsTrigger
              value="sellers"
              className="data-[state=active]:bg-cyan-200 data-[state=active]:shadow-[4px_4px_0_#000] cursor-pointer"
            >
              Sellers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buyers" id="buyers">
            <div className="grid gap-4 md:grid-cols-2">
              <FaqCard title="Buyer essentials" faqs={buyerFaqs} hue="yellow" />
              <PolicyCard />
            </div>
          </TabsContent>

          <TabsContent value="sellers" id="sellers">
            <div className="grid gap-4 md:grid-cols-2">
              <FaqCard title="Seller essentials" faqs={sellerFaqs} hue="cyan" />
              <SellerTipsCard />
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Contact + Escalations */}
      <section id="contact" className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
            <CardHeader>
              <CardTitle className="text-xl font-black">Contact us</CardTitle>
            </CardHeader>
            <CardContent>
              <SupportContactForm />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
            <CardHeader>
              <CardTitle className="text-xl font-black">
                Escalation flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal pl-4">
                <li>
                  Start on your <strong>order page</strong> →{' '}
                  <em>Message seller</em>.
                </li>
                <li>
                  No reply in <strong>48 hours</strong> or no tracking in{' '}
                  <strong>3 business days</strong>? Click{' '}
                  <strong>Escalate</strong> from the order.
                </li>
                <li>
                  Have <strong>photos/video</strong> ready (item, packaging,
                  label).
                </li>
              </ol>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Abandoned Hobby is a marketplace: sellers handle listings &
                shipping; we provide secure payments, fraud checks, and platform
                support.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ JSON-LD for SEO */}
      <Script
        id="faq-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c')
        }}
      />
    </main>
  );
}
