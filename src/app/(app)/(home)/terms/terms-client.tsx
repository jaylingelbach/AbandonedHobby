'use client';

import Link from 'next/link';
import { sections, LAST_UPDATED, type TermsSection } from './terms-content';

const nbCard =
  'rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] bg-white p-6 focus-within:outline focus-within:outline-4 focus-within:outline-black';
const nbHeader =
  'rounded-2xl border-4 border-black shadow-[6px_6px_0_#000] p-6 focus-within:outline focus-within:outline-4 focus-within:outline-black bg-yellow-300';
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

function TableOfContents({ items }: { items: TermsSection[] }) {
  return (
    <nav aria-labelledby="toc-heading" className={`${nbCard} bg-blue-100`}>
      <h2 id="toc-heading" className="text-lg font-extrabold">
        Table of contents
      </h2>
      <ol className="mt-3 list-decimal pl-6 space-y-1">
        {items.map((s) => (
          <li key={s.id}>
            <a
              className="underline"
              href={`#${s.id}`}
              aria-describedby={`h-${s.id}`}
            >
              {s.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SectionList({ items }: { items: TermsSection[] }) {
  return (
    <div className="grid gap-4">
      {items.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className={`${nbCard}`}
          aria-labelledby={`h-${s.id}`}
        >
          <h2
            id={`h-${s.id}`}
            className="text-xl font-extrabold tracking-tight"
          >
            {s.heading}
          </h2>
          <div className="mt-3 leading-relaxed">{s.body}</div>
          <div className="mt-4">
            <a href="#top" className="underline">
              Back to top
            </a>
          </div>
        </section>
      ))}
    </div>
  );
}

export function TermsClient() {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        className="mx-auto max-w-4xl space-y-6 p-4 md:p-8"
        aria-labelledby="page-title"
        role="main"
      >
        <h1 id="top" className={srOnly}>
          Terms & Conditions
        </h1>

        <header className={nbHeader} role="banner">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1
                id="page-title"
                className="text-3xl font-extrabold tracking-tight"
              >
                Terms & Conditions
              </h1>
              <p className="mt-1 max-w-prose text-base">
                These Terms govern your use of Abandoned Hobby. Please read them
                carefully.
              </p>
              <p className="mt-2 text-sm">
                <span className={nbBadge}>Last updated: {LAST_UPDATED}</span>
              </p>
            </div>
            <div className="flex gap-3" aria-label="Quick links">
              <Link href="/pricing" className={`${nbButton}`}>
                Pricing & Fees
              </Link>
              <Link href="/support" className={`${nbButton} bg-orange-200`}>
                Support
              </Link>
            </div>
          </div>
        </header>

        <TableOfContents items={sections} />
        <SectionList items={sections} />

        <footer
          className="mt-8 flex flex-wrap items-center justify-between gap-3"
          role="contentinfo"
        >
          <p className="text-sm">
            Questions about these Terms? We’re here to help.
          </p>
          <div className="flex gap-3">
            <Link href="/support" className={nbButton}>
              Contact Support
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
