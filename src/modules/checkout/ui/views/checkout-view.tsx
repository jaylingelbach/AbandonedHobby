'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { toast } from 'sonner';
import { InboxIcon, LoaderIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTRPC } from '@/trpc/client';
import { buildSignInUrl, generateTenantURL } from '@/lib/utils';
import { track } from '@/lib/analytics';

import { useCart } from '../../hooks/use-cart';
import { useCheckoutState } from '../../hooks/use-checkout-states';

import { CheckoutItem } from '../components/checkout-item';
import CheckoutSidebar from '../components/checkout-sidebar';
import CheckoutBanner from './checkout-banner';

interface CheckoutViewProps {
  tenantSlug: string;
}

export const CheckoutView = ({ tenantSlug }: CheckoutViewProps) => {
  const [states, setStates] = useCheckoutState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { productIds, removeProduct, clearCart } = useCart(tenantSlug);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Build query options once for stable keys
  const productsQueryOptions = trpc.checkout.getProducts.queryOptions({
    ids: productIds
  });

  // Load products in cart (localStorage-driven, so no SSR/hydration needed)
  const { data, error, isLoading, isFetching, isError, refetch } = useQuery({
    ...productsQueryOptions,
    enabled: productIds.length > 0, // don't fetch for empty cart
    placeholderData: (prev) => prev,
    retry: 1
  });

  // Session (to label userType)
  const { data: session } = useQuery(trpc.auth.session.queryOptions());

  const purchase = useMutation(
    trpc.checkout.purchase.mutationOptions({
      onMutate: () => setStates({ success: false, cancel: false }),
      onSuccess: (payload) => {
        window.location.assign(payload.url);
      },
      onError: (err) => {
        const code = (err as unknown as { data?: { code?: string } })?.data
          ?.code;
        if (code === 'UNAUTHORIZED') {
          const next =
            typeof window !== 'undefined' ? window.location.href : '/';
          window.location.assign(buildSignInUrl(next));
        } else {
          console.error('checkout.purchase failed:', err);
          toast.error('Checkout failed. Please try again.');
        }
      }
    })
  );

  // Single flag for disabling “Return to checkout”
  const disableResume =
    productIds.length === 0 || purchase.isPending || isFetching;

  // Handle ?cancel=true (Stripe cancel_url) — set state and clean URL
  useEffect(() => {
    const isCanceled = searchParams.get('cancel') === 'true';
    if (!isCanceled) return;

    setStates({ cancel: true, success: false });

    const url = new URL(window.location.href);
    url.searchParams.delete('cancel');
    const qs = url.searchParams.toString();
    router.replace(qs ? `${url.pathname}?${qs}` : url.pathname, {
      scroll: false
    });
  }, [router, searchParams, setStates]);

  // Clear cart if server says products are invalid
  useEffect(() => {
    const code = (error as unknown as { data?: { code?: string } })?.data?.code;
    if (code === 'NOT_FOUND') {
      clearCart();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error, clearCart]);

  // Success flow (if you toggle via state after returning from success_url)
  useEffect(() => {
    if (!states.success) return;

    setStates({ success: false, cancel: false });
    clearCart();

    // Refresh library queries
    queryClient.invalidateQueries(trpc.library.getMany.infiniteQueryFilter());
    router.push('/orders');
  }, [states.success, clearCart, router, setStates, queryClient]);

  // ---- Analytics: checkout_cancelled on page load with cancel=true ----
  const sentCancelEventRef = useRef(false);
  useEffect(() => {
    if (!states.cancel || sentCancelEventRef.current) return;

    // Compute metrics (fallbacks safe if data is not ready yet)
    const itemCount = productIds.length;
    const cartTotalCents =
      typeof data?.totalCents === 'number'
        ? data.totalCents
        : Math.round((data?.totalPrice ?? 0) * 100);

    const userType = session?.user ? 'auth' : 'guest';

    track('checkout_canceled', {
      tenantSlug,
      itemCount,
      cartTotalCents,
      userType
    });

    sentCancelEventRef.current = true;
  }, [states.cancel, data, productIds.length, tenantSlug, session?.user]);

  // ----- Renders -----

  // Loading: show spinner if there are items to fetch
  if (productIds.length > 0 && isLoading) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled={disableResume}
            onReturnToCheckout={() => purchase.mutate({ productIds })}
            onDismiss={() => setStates({ cancel: false, success: false })}
            onClearCart={() => {
              clearCart();
              setStates({ cancel: false, success: false });
            }}
          />
        )}
        <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-4 bg-white w-full rounded-lg">
          <LoaderIcon className="text-muted-foreground animate-spin" />
          <p className="text-sm font-medium">Loading your cart…</p>
        </div>
      </div>
    );
  }

  // Error or missing data (avoid crashing on data!)
  if (productIds.length > 0 && (isError || !data)) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled
            onDismiss={() => setStates({ cancel: false, success: false })}
            onClearCart={() => {
              clearCart();
              setStates({ cancel: false, success: false });
            }}
          />
        )}
        <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-4 bg-white w-full rounded-lg">
          <InboxIcon />
          <p className="text-sm font-medium">
            We couldn’t load your cart. Please retry.
          </p>
          <button
            className="underline text-sm"
            type="button"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty cart (no ids OR fetched result is empty)
  if (productIds.length === 0 || (data && data.totalDocs === 0)) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled // no items to resume with
            onDismiss={() => setStates({ cancel: false, success: false })}
            onClearCart={() => {
              clearCart();
              setStates({ cancel: false, success: false });
            }}
          />
        )}
        <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-y-4 bg-white rounded-lg mt-4">
          <InboxIcon />
          <p className="text-base font-medium">Your cart is empty</p>
        </div>
      </div>
    );
  }

  // Safe locals
  const docs = data?.docs ?? [];
  const totalCents =
    typeof data?.totalCents === 'number'
      ? data.totalCents
      : Math.round((data?.totalPrice ?? 0) * 100);

  return (
    <div className="lg:pt-12 pt-4 px-4 lg:px-12">
      {states.cancel && (
        <CheckoutBanner
          disabled={disableResume}
          onReturnToCheckout={() => purchase.mutate({ productIds })}
          onDismiss={() => setStates({ cancel: false, success: false })}
          onClearCart={() => {
            clearCart();
            setStates({ cancel: false, success: false });
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-16 mt-4">
        {/* Items */}
        <div className="lg:col-span-4">
          <div className="border rounded-md overflow-hidden bg-white">
            {docs.map((product, index) => (
              <CheckoutItem
                key={product.id}
                isLast={index === docs.length - 1}
                imageURL={product.image?.url}
                name={product.name}
                productURL={`${generateTenantURL(product.tenant.slug)}/products/${product.id}`}
                tenantURL={`${generateTenantURL(product.tenant.slug)}`}
                tenantName={product.tenant.name}
                price={product.price}
                onRemove={() => removeProduct(product.id)}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3">
          <CheckoutSidebar
            total={totalCents / 100}
            onPurchase={() => purchase.mutate({ productIds })}
            isCanceled={states.cancel}
            disabled={purchase.isPending || isFetching}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutView;
