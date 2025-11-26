'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ArrowLeftIcon, CheckCircle2, ReceiptIcon } from 'lucide-react';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { buildSignInUrl, formatCents, generateTenantURL } from '@/lib/utils';
import { cartDebug } from '@/modules/checkout/debug';
import { useTRPC } from '@/trpc/client';

// ─── Project Hooks ───────────────────────────────────────────────────────────
import { useCartStore } from '@/modules/checkout/store/use-cart-store';

interface Props {
  sessionId: string;
}

/** Helper: render a single money line (label on left, value on right). */
function MoneyRow(props: {
  label: string;
  amountCents: number;
  currency: string;
  emph?: boolean;
  italicNote?: string | null;
}) {
  const {
    label,
    amountCents,
    currency,
    emph = false,
    italicNote = null
  } = props;
  return (
    <div className="flex items-baseline justify-between py-1">
      <div className="text-sm text-muted-foreground">
        {label}{' '}
        {italicNote ? (
          <em className="text-xs text-muted-foreground/80">({italicNote})</em>
        ) : null}
      </div>
      <div className={emph ? 'font-semibold text-base' : 'text-sm font-medium'}>
        {formatCents(amountCents, currency)}
      </div>
    </div>
  );
}

/**
 * Fallback computer for amounts if `order.amounts` is ever missing.
 * (You mentioned you’ve cleaned old orders, but keeping this makes the UI resilient.)
 * - subtotal: sum of item.amountSubtotalCents
 * - shipping: 0
 * - tax: sum of item.amountTaxCents (treat null as 0)
 * - discount: 0
 * - total: order.totalCents (already persisted)
 */
function computeFallbackAmounts(order: {
  items: Array<{
    amountSubtotalCents: number;
    amountTaxCents: number | null;
  }>;
  totalCents: number;
}) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + (item.amountSubtotalCents || 0),
    0
  );
  const tax = order.items.reduce(
    (sum, item) => sum + (item.amountTaxCents || 0),
    0
  );
  return {
    subtotalCents: subtotal,
    shippingTotalCents: 0,
    discountTotalCents: 0,
    taxTotalCents: tax,
    totalCents: order.totalCents
  };
}

/**
 * Renders the order confirmation page for a checkout session.
 *
 * IMPORTANT: Protected tRPC queries are gated behind `mounted` so nothing runs during SSR,
 * avoiding "Must be logged in." errors when cookies/sessions aren't available server-side.
 */
export default function OrderConfirmationView({ sessionId }: Props) {
  const trpc = useTRPC();

  // Gate all protected queries to run ONLY after the component has mounted in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Confirmation query (protected) — DO NOT run on SSR.
  const confirmationBaseOptions =
    trpc.orders.getConfirmationBySession.queryOptions(
      { sessionId },
      { staleTime: 5_000 }
    );

  const { data, error, refetch, isLoading, isFetching } = useQuery({
    ...confirmationBaseOptions,
    enabled: mounted, // key: only fire after mount
    // keep your auto-refresh while webhook is pending
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
  const status = firstOrder?.status ?? null;
  const hasAnyOrder = orders.length > 0;

  const isSettled = useMemo(
    () =>
      status === 'paid' ||
      status === 'succeeded' ||
      status === 'complete' ||
      status === 'processing',
    [status]
  );
  // Prevent multiple clears if component re-renders
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!mounted) return; // wait until we're on the client
    if (clearedRef.current) return;

    // Optional: wait until we have an order or a "settled" status
    if (!hasAnyOrder && !isSettled) return;

    const scope = window.localStorage.getItem('ah_checkout_scope');

    cartDebug('success page: clearing cart for scope', {
      scope,
      byUserBefore: useCartStore.getState().byUser
    });

    const run = () => {
      if (scope) {
        useCartStore.getState().clearCartForScope(scope);
        window.localStorage.removeItem('ah_checkout_scope');
      } else {
        // Fallback if scope is missing: clear all carts for this user
        useCartStore.getState().clearAllCartsForCurrentUser();
      }

      cartDebug('success page: after clearing', {
        scopeUsed: scope,
        byUserAfter: useCartStore.getState().byUser
      });

      clearedRef.current = true;
    };

    const unsubscribe = useCartStore.persist?.onFinishHydration?.(run);
    if (useCartStore.persist?.hasHydrated?.()) run();
    return () => unsubscribe?.();
  }, [mounted, hasAnyOrder, isSettled]);

  // Not signed in (client-side)
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

  // While we wait to mount on client OR query is loading:
  // show your existing "finalizing" shell (also covers the brief gap before webhook write).
  if (!mounted || isLoading || (!error && !orders.length && isFetching)) {
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
          {orders.map((order) => {
            // Prefer server-authoritative amounts when present; otherwise fallback.
            const resolvedAmounts =
              order.amounts ??
              computeFallbackAmounts({
                items: order.items.map((i) => ({
                  amountSubtotalCents: i.amountSubtotalCents,
                  amountTaxCents: i.amountTaxCents
                })),
                totalCents: order.totalCents
              });

            const {
              subtotalCents,
              shippingTotalCents,
              discountTotalCents,
              taxTotalCents,
              totalCents
            } = resolvedAmounts;

            return (
              <div
                key={order.orderId}
                className="border border-black bg-white rounded-lg p-6 shadow-[6px_6px_0_0_#000]"
              >
                {/* Header: order number + grand total */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Order Number
                    </div>
                    <div className="text-lg font-medium">
                      {order.orderNumber}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReceiptIcon className="size-5" />
                    <span className="font-medium">
                      {formatCents(order.totalCents, order.currency)}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="mt-6">
                  <div className="text-sm text-muted-foreground mb-2">
                    Items
                  </div>
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
                          {formatCents(
                            item.amountSubtotalCents,
                            order.currency
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Totals (Subtotal / Shipping / Tax / Discount / Total) */}
                <div className="mt-6 border border-black rounded p-4 bg-[#F9F9F7]">
                  <div className="text-sm text-muted-foreground mb-1">
                    Summary
                  </div>

                  <MoneyRow
                    label="Subtotal"
                    amountCents={subtotalCents}
                    currency={order.currency}
                  />

                  <MoneyRow
                    label="Shipping"
                    amountCents={shippingTotalCents}
                    currency={order.currency}
                  />

                  <MoneyRow
                    label="Tax"
                    amountCents={taxTotalCents}
                    currency={order.currency}
                  />

                  {/* Display discount as a negative line when present */}
                  {discountTotalCents > 0 ? (
                    <MoneyRow
                      label="Discount"
                      amountCents={-discountTotalCents}
                      currency={order.currency}
                    />
                  ) : null}

                  <div className="border-t mt-2 pt-2">
                    <MoneyRow
                      label="Total"
                      amountCents={totalCents}
                      currency={order.currency}
                      emph
                    />
                  </div>
                </div>

                {/* Shipping address (if captured) */}
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

                {/* Returns cutoff */}
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

                {/* CTAs */}
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
            );
          })}
        </div>
      </section>
    </div>
  );
}
