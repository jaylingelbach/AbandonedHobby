'use client';

import Link from 'next/link';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import { ArrowLeftIcon, ReceiptIcon, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  sessionId: string;
}

/**
 * Success screen using OrderSummaryDTO[].
 * - Shows "finalizing" state if the webhook hasn't written orders yet.
 * - Lightly polls for up to ~30s to catch slow webhooks.
 */
export default function OrderSuccessSummaryView({ sessionId }: Props) {
  const trpc = useTRPC();

  const queryOptions = trpc.orders.getSummaryBySession.queryOptions(
    { sessionId },
    { staleTime: 5_000 }
  );

  const [pollAttempts, setPollAttempts] = useState(0);

  const { data, refetch } = useSuspenseQuery({
    ...queryOptions,
    refetchInterval: (query) => {
      const hasAny =
        Array.isArray(query.state.data?.orders) &&
        query.state.data.orders.length > 0;
      const updatedAt = query.state.dataUpdatedAt ?? 0;
      const elapsedMs = Date.now() - updatedAt;
      const withinWindow = elapsedMs < 60_000;
      if (hasAny || !withinWindow) return false;
      const intervals = [2000, 4000, 8000, 10000];
      const interval = intervals[Math.min(pollAttempts, intervals.length - 1)];
      setPollAttempts((prev) => prev + 1);
      return interval;
    }
  });

  const orders = data?.orders ?? [];

  // Pending: no orders yet—webhook probably still running
  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="p-4 bg-[#F4F4F0] w-full border-b">
          <Link prefetch href="/" className="flex items-center gap-2">
            <ArrowLeftIcon className="size-4" />
            <span className="text font-medium">Continue shopping</span>
          </Link>
        </nav>
        <header className="bg-[#F4F4F0] py-8 border-b">
          <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
            <h1 className="text-[40px] font-medium">Finalizing your order…</h1>
            <p className="font-medium mt-2">
              We’re confirming your payment and generating the receipt.
              <button onClick={() => refetch()} className="underline ml-2">
                Refresh
              </button>
            </p>
            <p className="font-medium mt-2">
              Ref: <code>{sessionId}</code>
            </p>
          </div>
        </header>
        <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
          <div className="border border-black border-dashed p-8 bg-white rounded-lg">
            <p className="font-medium">
              If this takes more than a minute, you can revisit this page from
              your browser history, or check{' '}
              <Link prefetch href="/orders" className="underline">
                Your orders
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    );
  }

  // Confirmed: show one or more summaries (usually one since you enforce single-seller)
  return (
    <div className="min-h-screen bg-white">
      <nav className="p-4 bg-[#F4F4F0] w-full border-b">
        <Link prefetch href="/" className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium">Continue shopping</span>
        </Link>
      </nav>

      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[40px] font-medium flex items-center gap-2">
            <CheckCircle2 className="size-8" />
            Thanks! Your order is confirmed.
          </h1>
          <p className="font-medium mt-2">We’ve sent a confirmation email.</p>
        </div>
      </header>

      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10 space-y-6">
        {orders.map((summary) => (
          <div
            key={summary.orderId}
            className="border border-black bg-white rounded-lg p-6 shadow-[6px_6px_0_0_#000]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">
                  Order Number
                </div>
                <div className="text-lg font-medium">{summary.orderNumber}</div>
              </div>
              <div className="flex items-center gap-2">
                <ReceiptIcon className="size-5" />
                <span className="font-medium">
                  {(() => {
                    try {
                      return (summary.totalCents / 100).toLocaleString(
                        undefined,
                        {
                          style: 'currency',
                          currency: summary.currency.toUpperCase()
                        }
                      );
                    } catch {
                      // Fallback to simple formatting if currency code is invalid
                      return `${summary.currency.toUpperCase()} ${(summary.totalCents / 100).toFixed(2)}`;
                    }
                  })()}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-black border-dashed rounded p-4">
                <div className="text-sm text-muted-foreground">Order date</div>
                <div className="font-medium">
                  {new Date(summary.orderDateISO).toLocaleString()}
                </div>
              </div>

              <div className="border border-black border-dashed rounded p-4">
                <div className="text-sm text-muted-foreground">Items</div>
                <div className="font-medium">{summary.quantity}</div>
              </div>
            </div>

            {summary.returnsAcceptedThroughISO ? (
              <div className="mt-4 border border-black border-dashed rounded p-4">
                <div className="text-sm text-muted-foreground">
                  Returns accepted through
                </div>
                <div className="font-medium">
                  {new Date(
                    summary.returnsAcceptedThroughISO
                  ).toLocaleDateString()}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                prefetch
                href="/orders"
                className="px-4 py-2 bg-white border border-black rounded shadow-[4px_4px_0_0_#000] font-medium"
              >
                View all orders
              </Link>
              <Link
                prefetch
                href={`/products/${summary.productId}`}
                className="px-4 py-2 bg-white border border-black rounded shadow-[4px_4px_0_0_#000] font-medium"
              >
                View product
              </Link>
              <Link
                prefetch
                href="/"
                className="px-4 py-2 bg-white border border-black rounded shadow-[4px_4px_0_0_#000] font-medium"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
