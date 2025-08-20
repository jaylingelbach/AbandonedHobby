'use client';

import * as React from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useMemo, useState } from 'react';
import {
  Search,
  Truck,
  MessageSquare,
  RefreshCw,
  Flag,
  Lock,
  CheckCircle2,
  DollarSign,
  Wallet,
  Shield,
  HelpCircle,
  Bell
} from 'lucide-react';

// shadcn/ui
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default function SupportPage() {
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
        href: '/sign-in?reset=1',
        icon: Lock,
        color: 'bg-violet-300'
      },
      {
        label: 'Verify seller account',
        href: '/dashboard/payouts',
        icon: CheckCircle2,
        color: 'bg-lime-300'
      },
      {
        label: 'Set up payouts',
        href: '/dashboard/payouts',
        icon: Wallet,
        color: 'bg-sky-300'
      },
      {
        label: 'Fees & taxes',
        href: '/support/policies#fees',
        icon: DollarSign,
        color: 'bg-orange-300'
      },
      {
        label: 'Message center',
        href: '/messages',
        icon: Bell,
        color: 'bg-yellow-300'
      }
    ],
    []
  );

  // --- FAQs (copy-ready defaults)
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
            <strong>Dashboard → Payouts</strong>. You can’t list for sale until
            this is done.
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
                <div
                  role="listbox"
                  aria-label="Search suggestions"
                  className="mt-3 grid gap-2 md:grid-cols-2"
                >
                  {searchable.map((s, idx) => (
                    <Link key={idx} href={s.href} className="group">
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
                  ))}
                </div>
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
        <Tabs defaultValue="buyers" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-2 rounded-2xl border-4 border-black bg-white p-1 shadow-[6px_6px_0_#000]">
            <TabsTrigger
              value="buyers"
              className="data-[state=active]:bg-yellow-200 data-[state=active]:shadow-[4px_4px_0_#000]"
            >
              Buyers
            </TabsTrigger>
            <TabsTrigger
              value="sellers"
              className="data-[state=active]:bg-cyan-200 data-[state=active]:shadow-[4px_4px_0_#000]"
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
              <ContactForm />
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
                Abandoned Hobbies is a marketplace: sellers handle listings &
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  );
}

// --- Components -----------------------------------------------------------

type QA = { q: string; a: React.ReactNode };

function FaqCard({
  title,
  faqs,
  hue = 'yellow'
}: {
  title: string;
  faqs: QA[];
  hue?: 'yellow' | 'cyan';
}) {
  const chip = hue === 'yellow' ? 'bg-yellow-200' : 'bg-cyan-200';
  return (
    <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-black">
          <HelpCircle className="h-5 w-5" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl border-4 border-black px-3 py-2 shadow-[6px_6px_0_#000] not-first:mt-3"
            >
              <AccordionTrigger className="text-left">
                <span
                  className={`mr-2 rounded-md border-2 border-black ${chip} px-1 text-[10px] font-black`}
                >
                  FAQ
                </span>
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function PolicyCard() {
  return (
    <Card
      id="policies"
      className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]"
    >
      <CardHeader>
        <CardTitle className="text-xl font-black">Policies & Safety</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-xl border-4 border-black bg-yellow-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Ship-by window</h3>
          <p>
            Tracking must be provided within <strong>3 business days</strong>.
          </p>
        </div>
        <div className="rounded-xl border-4 border-black bg-cyan-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Buyer escalation</h3>
          <p>
            Allowed after <strong>48 hours</strong> of seller no-response.
          </p>
        </div>
        <div className="rounded-xl border-4 border-black bg-emerald-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Return window</h3>
          <p>
            Claims for damaged/SNAD within <strong>7 days</strong> of delivery.
          </p>
        </div>
        <div className="rounded-xl border-4 border-black bg-rose-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Counterfeits & safety</h3>
          <p>Zero tolerance; listings removed, accounts reviewed.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          These are platform-wide minimums—sellers may offer better terms but
          not worse.
        </p>
      </CardContent>
    </Card>
  );
}

function SellerTipsCard() {
  return (
    <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
      <CardHeader>
        <CardTitle className="text-xl font-black">
          Shipping & Returns tips
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="list-disc pl-5">
          <li>Use sturdy boxes; pad corners for heavier gear.</li>
          <li>Always photograph item condition & packing before sealing.</li>
          <li>Add tracking within 3 business days to avoid penalties.</li>
          <li>
            Process refunds within the order page to keep records aligned.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [topic, setTopic] = useState('Order');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    // TODO: Wire this to your endpoint (e.g., /api/support). This is a friendly stub.
    try {
      const payload = Object.fromEntries(form.entries());
      console.log('Support form payload', payload);
      alert("Thanks! We've received your message and will reply by email.");
      (e.currentTarget as HTMLFormElement).reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-bold">I am a</label>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setRole('buyer')}
              variant={role === 'buyer' ? 'default' : 'secondary'}
              className={`rounded-xl border-4 border-black shadow-[4px_4px_0_#000] ${role === 'buyer' ? 'bg-yellow-300' : 'bg-white'}`}
              aria-pressed={role === 'buyer'}
            >
              Buyer
            </Button>
            <Button
              type="button"
              onClick={() => setRole('seller')}
              variant={role === 'seller' ? 'default' : 'secondary'}
              className={`rounded-xl border-4 border-black shadow-[4px_4px_0_#000] ${role === 'seller' ? 'bg-cyan-300' : 'bg-white'}`}
              aria-pressed={role === 'seller'}
            >
              Seller
            </Button>
          </div>
          <input type="hidden" name="role" value={role} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="topic">
            Topic
          </label>
          <select
            id="topic"
            name="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-10 w-full rounded-xl border-4 border-black bg-white px-3 shadow-[4px_4px_0_#000] focus:outline-none"
          >
            <option>Order</option>
            <option>Listing</option>
            <option>Payout</option>
            <option>Account</option>
            <option>Bug</option>
            <option>Abuse/Report</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="ref">
            Order ID / Listing URL
          </label>
          <Input
            id="ref"
            name="reference"
            placeholder="#12345 or https://…"
            className="rounded-xl border-4 border-black shadow-[4px_4px_0_#000]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="email">
            Contact email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="rounded-xl border-4 border-black shadow-[4px_4px_0_#000]"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold" htmlFor="desc">
          What happened? What outcome do you expect?
        </label>
        <Textarea
          id="desc"
          name="description"
          required
          rows={5}
          className="rounded-2xl border-4 border-black shadow-[4px_4px_0_#000]"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: include photos of the item, packaging, and label—this speeds
          things up.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          By submitting you agree to our{' '}
          <Link className="underline" href="/terms">
            Terms
          </Link>{' '}
          and{' '}
          <Link className="underline" href="/privacy">
            Privacy Policy
          </Link>
          .
        </div>
        <Button
          disabled={submitting}
          className="rounded-2xl border-4 border-black bg-black text-white shadow-[6px_6px_0_#000] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[4px_4px_0_#000]"
        >
          {submitting ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}

// Utility: render ReactNode to plain text for JSON-LD answer text
function renderToText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderToText).join(' ');
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return renderToText(el.props.children);
  }
  return '';
}
