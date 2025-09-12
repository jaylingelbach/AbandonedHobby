'use client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { InboxIcon, LoaderIcon } from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateTenantURL } from '@/lib/utils';

import { CheckoutItem } from '../components/checkout-item';
import { useCart } from '../../hooks/use-cart';
import { useCheckoutState } from '../../hooks/use-checkout-states';
import CheckoutSidebar from '../components/checkout-sidebar';
import CheckoutBanner from './checkout-banner';

import { buildSignInUrl } from '@/lib/utils';

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

  // Load products in cart (localStorage-driven, so no SSR/hydration needed)
  const { data, error, isLoading } = useQuery(
    trpc.checkout.getProducts.queryOptions({ ids: productIds })
  );

  const purchase = useMutation(
    trpc.checkout.purchase.mutationOptions({
      onMutate: () => {
        setStates({ success: false, cancel: false });
      },
      onSuccess: (data) => {
        window.location.assign(data.url);
      },
      onError: (error) => {
        console.error('Error: ', error);
        const next = typeof window !== 'undefined' ? window.location.href : '/';
        window.location.assign(buildSignInUrl(next));
      }
    })
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isCanceled = searchParams.get('cancel') === 'true';
    if (!isCanceled) return;
    setStates({ cancel: true, success: false });
    // Remove ?cancel=true so the banner doesn't persist on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete('cancel');
    router.replace(url.pathname + (url.search ? `?${url.searchParams}` : ''), {
      scroll: false
    });
  }, []);

  useEffect(() => {
    if (error?.data?.code === 'NOT_FOUND') {
      clearCart();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error, clearCart]);

  useEffect(() => {
    if (states.success) {
      setStates({ success: false, cancel: false });
      clearCart();
      // invalidates and refreshes library query
      queryClient.invalidateQueries(trpc.library.getMany.infiniteQueryFilter());
      router.push('/orders');
    }
  }, [
    states.success,
    clearCart,
    router,
    setStates,
    queryClient,
    trpc.library.getMany
  ]);

  useEffect(() => {
    if (error?.data?.code === 'NOT_FOUND') {
      clearCart();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error, clearCart]);

  if (!data || data.totalDocs === 0) {
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
        <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-y-4 bg-white rounded-lg mt-4">
          <InboxIcon />
          <p className="text-base font-medium">Your cart is empty</p>
        </div>
      </div>
    );
  }

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
            {data.docs.map((product, index) => (
              <CheckoutItem
                key={product.id}
                isLast={index === data.docs.length - 1}
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
            total={data.totalPrice || 0}
            onPurchase={() => purchase.mutate({ productIds })}
            isCanceled={states.cancel}
            disabled={purchase.isPending}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutView;
