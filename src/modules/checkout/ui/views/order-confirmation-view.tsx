'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ArrowLeftIcon, CheckCircle2, ReceiptIcon } from 'lucide-react';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { buildSignInUrl, formatCents, generateTenantURL } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

// ─── Project Hooks ───────────────────────────────────────────────────────────
import { useCart } from '@/modules/checkout/hooks/use-cart';

interface Props {
  sessionId: string;
}

/**
 * Renders the order confirmation page for a checkout session.
 *
 * Displays a pending "finalizing" state while confirmation data is awaited, an unauthorized sign-in prompt if the user is not authorized, or a detailed receipt view for one or more confirmed orders. The component also clears the shopping cart once per tenant when an order is present or the order status is settled.
 *
 * @param sessionId - The checkout session identifier used to fetch confirmation data
 * @returns The order confirmation UI for the given session
 */

export default function OrderConfirmationView({ sessionId }: Props) {
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());

  // Query (always call hooks)
  const queryOptions = trpc.orders.getConfirmationBySession.queryOptions(
    { sessionId },
    { staleTime: 5_000 }
  );
  const { data, error, refetch } = useSuspenseQuery({
    ...queryOptions,
    refetchInterval: (query) => {
      const hasOrders =
        Array.isArray(query.state.data?.orders) &&
        query.state.data.orders.length > 0;
      const updatedAt = query.state.dataUpdatedAt ?? 0;
      const elapsed = Date.now() - updatedAt;
      return hasOrders || elapsed > 30_000 ? false : 2_000;
    }
  });

  // Derive values *before* any early return so hooks below stay unconditional.
  const orders = data?.orders ?? [];
  const firstOrder = orders[0]; // may be undefined while webhook is pending
  const { clearCart } = useCart(firstOrder?.tenantSlug, session?.user?.id);

  // Derive stable primitives for deps
  const tenantSlug = firstOrder?.tenantSlug ?? null;
  const status = firstOrder?.status ?? null;
  const hasAnyOrder = orders.length > 0;

  // Optionally decide what statuses count as “paid”
  const isSettled = useMemo(
    () =>
      status === 'paid' ||
      status === 'succeeded' ||
      status === 'complete' ||
      status === 'processing',
    [status]
  );

  // Prevent multiple clears if component re-renders
  const clearedForTenantRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;

    // Only clear once per tenantSlug
    if (clearedForTenantRef.current === tenantSlug) return;

    // Clear when we have any order OR a settled status (pick either/both)
    if (hasAnyOrder || isSettled) {
      console.log('[cart] clearing on confirmation', { tenantSlug, status });
      clearCart();
      clearedForTenantRef.current = tenantSlug;
    }
  }, [tenantSlug, hasAnyOrder, isSettled, clearCart, status]);

  // Not signed in
  if (error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED') {
    return (
      <div className="min-h-screen bg-white p-8">
        <p className="font-medium">Please sign in to view your receipt.</p>
        <a href={buildSignInUrl(window.location.href)} className="underline">
          Sign in
        </a>
      </div>
    );
  }

  // Pending webhook: no orders yet
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
          </div>
        </header>
        <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
          <div className="border border-black border-dashed p-8 bg-white rounded-lg">
            <p className="font-medium">
              If this takes more than a minute, check{' '}
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

  // Confirmed
  return (
    <div className="min-h-screen bg-white">
      <nav className="p-4 bg-[#F4F4F0] w-full">
        <Link prefetch href="/" className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium">Continue shopping</span>
        </Link>
      </nav>

      <header className="bg-[#F4F4F0] py-8 ">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[40px] font-medium flex items-center gap-2">
            <CheckCircle2 className="size-8" />
            Thanks! Your order is confirmed.
          </h1>
          <p className="font-medium mt-2">We’ve emailed your confirmation.</p>
        </div>
      </header>

      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="border border-black bg-white rounded-lg p-6 shadow-[6px_6px_0_0_#000]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Order Number
                  </div>
                  <div className="text-lg font-medium">{order.orderNumber}</div>
                </div>
                <div className="flex items-center gap-2">
                  <ReceiptIcon className="size-5" />
                  <span className="font-medium">
                    {formatCents(order.totalCents, order.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm text-muted-foreground mb-2">Items</div>
                <ul className="space-y-2">
                  {order.items.map((item) => (
                    <li
                      key={`${order.orderId}-${item.productId}`}
                      className="border border-black border-dashed rounded p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Qty {item.quantity} •{' '}
                          {formatCents(item.unitAmountCents, order.currency)}
                        </div>
                        {item.returnsAcceptedThroughISO ? (
                          <div className="text-xs mt-1">
                            Return by{' '}
                            {new Date(
                              item.returnsAcceptedThroughISO
                            ).toLocaleDateString()}
                          </div>
                        ) : null}
                      </div>
                      <div className="ml-4 font-medium">
                        {formatCents(item.amountSubtotalCents, order.currency)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {order.shipping && order.shipping.line1 ? (
                <div className="mt-6 border border-black rounded p-4">
                  <div className="text-sm text-muted-foreground">
                    Shipping to
                  </div>
                  {order.shipping.name ? (
                    <div className="font-medium">{order.shipping.name}</div>
                  ) : null}
                  <div className="text-sm mt-1">
                    {order.shipping.line1}
                    {order.shipping.line2 ? (
                      <>
                        <br />
                        {order.shipping.line2}
                      </>
                    ) : null}
                    {order.shipping.city && order.shipping.state ? (
                      <>
                        <br />
                        {order.shipping.city}, {order.shipping.state}{' '}
                        {order.shipping.postalCode || ''}
                      </>
                    ) : null}
                    {order.shipping.country ? (
                      <>
                        <br />
                        {order.shipping.country}
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {order.returnsAcceptedThroughISO ? (
                <div className="mt-6 border border-black border-dashed rounded p-4">
                  <div className="text-sm text-muted-foreground">
                    Returns accepted through
                  </div>
                  <div className="font-medium">
                    {new Date(
                      order.returnsAcceptedThroughISO
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
                {order.tenantSlug ? (
                  <Link
                    prefetch
                    href={generateTenantURL(order.tenantSlug)}
                    className="px-4 py-2 bg-white border border-black rounded shadow-[4px_4px_0_0_#000] font-medium"
                  >
                    Visit seller
                  </Link>
                ) : null}
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
        </div>
      </section>
    </div>
  );
}
