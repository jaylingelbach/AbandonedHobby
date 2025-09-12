'use client';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { InboxIcon, LoaderIcon } from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildSignInUrl, generateTenantURL } from '@/lib/utils';

import { CheckoutItem } from '../components/checkout-item';
import { useCart } from '../../hooks/use-cart';
import { useCheckoutState } from '../../hooks/use-checkout-states';
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

  // Build query options once and add react-query config
  const productsQueryOptions = trpc.checkout.getProducts.queryOptions({
    ids: productIds
  });

  const { data, error, isLoading, isFetching } = useQuery({
    ...productsQueryOptions, // from trpc.checkout.getProducts.queryOptions({ ids })
    enabled: productIds.length > 0, // don't fetch for empty cart
    placeholderData: (prev) => prev,
    retry: 1
  });

  const purchase = useMutation(
    trpc.checkout.purchase.mutationOptions({
      onMutate: () => {
        setStates({ success: false, cancel: false });
      },
      onSuccess: (payload) => {
        window.location.assign(payload.url);
      },
      onError: (err) => {
        console.error('checkout.purchase failed:', err);
        const code = err?.data?.code;
        if (code === 'UNAUTHORIZED') {
          const next =
            typeof window !== 'undefined' ? window.location.href : '/';
          window.location.assign(buildSignInUrl(next));
        } else {
          toast.error('Checkout failed. Please try again.');
        }
      }
    })
  );

  // Handle ?cancel=true (Stripe cancel_url)
  useEffect(() => {
    const isCanceled = searchParams.get('cancel') === 'true';
    if (!isCanceled) return;

    setStates({ cancel: true, success: false });

    // Remove the param so the banner doesn't persist on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete('cancel');
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router, searchParams, setStates]);

  // Clear cart if server says products are invalid
  useEffect(() => {
    if (error?.data?.code === 'NOT_FOUND') {
      clearCart();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error, clearCart]);

  // Success flow coming from success_url (if you still use that route state)
  useEffect(() => {
    if (!states.success) return;

    setStates({ success: false, cancel: false });
    clearCart();

    // Refresh library queries
    queryClient.invalidateQueries(trpc.library.getMany.infiniteQueryFilter());
    router.push('/orders');
  }, [
    states.success,
    clearCart,
    router,
    setStates,
    queryClient,
    trpc.library.getMany
  ]);

  // ----- Renders -----

  // Loading: show spinner if there are items to fetch
  if (productIds.length > 0 && isLoading) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
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

  // Empty cart (no ids OR fetched result is empty)
  if (productIds.length === 0 || data?.totalDocs === 0) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
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

  // Normal render
  return (
    <div className="lg:pt-12 pt-4 px-4 lg:px-12">
      {states.cancel && (
        <CheckoutBanner
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
            {data!.docs.map((product, index) => (
              <CheckoutItem
                key={product.id}
                isLast={index === data!.docs.length - 1}
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
            total={(data!.totalCents ?? 0) / 100}
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
