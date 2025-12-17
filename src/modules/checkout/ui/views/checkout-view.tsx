'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { useMutation } from '@tanstack/react-query';
import { InboxIcon, LoaderIcon } from 'lucide-react';
import { toast } from 'sonner';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { buildSignInUrl } from '@/lib/utils';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { useTRPC } from '@/trpc/client';

// ─── Project Hooks / Stores ──────────────────────────────────────────────────
import { useCheckoutState } from '@/modules/checkout/hooks/use-checkout-states';
import { cartDebug } from '@/modules/checkout/debug';

// ─── Project Components ──────────────────────────────────────────────────────
import CheckoutBanner from './checkout-banner';
import TenantCheckoutSection from '@/modules/checkout/ui/views/tenant-checkout-section';

// ─── New multi-tenant hook/types ─────────────────────────────────────────────
import {
  TenantCheckoutGroup,
  useMultiTenantCheckoutData
} from '@/modules/checkout/hooks/use-multi-tenant-checkout-data';
import { CheckoutLineInput } from '@/lib/validation/seller-order-validation-types';
import { TRPCClientError } from '@trpc/client';
import MessageCard from '@/modules/checkout/ui/views/message-card';
import { getMissingProductIdsFromError, isTrpcErrorShape } from './utils';
import { usePruneMissingProductsForViewer } from '@/modules/cart/hooks/use-prune-missing-products-for-viewer';
import { useServerCart } from '@/modules/cart/hooks/use-server-cart';
import { useClearAllCartsForIdentity } from '@/modules/cart/hooks/use-clear-all-carts-for-identity';

interface CheckoutViewProps {
  tenantSlug?: string;
}

export const CheckoutView = ({ tenantSlug }: CheckoutViewProps) => {
  const [states, setStates] = useCheckoutState();
  const [mounted, setMounted] = useState(false);

  const { pruneMissingProductsAsync } = usePruneMissingProductsForViewer();
  type ClearCartAsyncFn = () => Promise<unknown>;
  type ClearAllCartsForIdentityAsyncFn = () => Promise<unknown>;

  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();

  // Always call the hook with a fallback slug; guard usage based on tenantSlug presence
  const serverCart = useServerCart(tenantSlug);
  const clearCartAsync: ClearCartAsyncFn | undefined = tenantSlug
    ? async () => {
        await serverCart.clearCartAsync();
      }
    : undefined;
  const clearAllCartsForIdentityResult = useClearAllCartsForIdentity();
  const clearAllCartsForIdentityAsync:
    | ClearAllCartsForIdentityAsyncFn
    | undefined = clearAllCartsForIdentityResult?.clearAllCartsForIdentityAsync;

  // Multi-tenant cart + products
  const {
    data: multiData,
    isLoading,
    isFetching,
    isError,
    cartError,
    productError,
    refetch
  } = useMultiTenantCheckoutData();

  // Handle NOT_FOUND from checkout.getProducts – remove only missing items when possible
  useEffect(() => {
    if (!productError) return;

    const productErrorTyped =
      productError instanceof TRPCClientError ? productError : null;
    if (!productErrorTyped) return;

    const rawData = productErrorTyped?.data;
    let code: string | undefined;

    if (
      rawData &&
      typeof rawData === 'object' &&
      'code' in rawData &&
      typeof (rawData as { code?: unknown }).code === 'string'
    ) {
      code = (rawData as { code?: string }).code;
    }

    if (code !== 'NOT_FOUND') return;

    const missingProductIds = getMissingProductIdsFromError(productErrorTyped);

    if (missingProductIds.length > 0) {
      let isMounted = true;
      pruneMissingProductsAsync(missingProductIds)
        .then(() => {
          if (!isMounted) return;
          void refetch();
          toast.warning(
            'Some items in your cart were removed because they are no longer available.'
          );
        })
        .catch((error) => {
          console.warn('[pruneMissingProductAsync] promise rejected: ', error);
        });
      return () => {
        isMounted = false;
      };

      // Refetch to show updated cart without requiring manual retry
    } else {
      // Fallback if we didn’t get details for some reason
      console.error(`[pruneMissingProductsAsync] Problem loading cart`);
    }
  }, [productError, pruneMissingProductsAsync, refetch]);

  const groups = multiData?.groups ?? [];
  const hasAnyItems = groups.length > 0;

  // Track which seller + lines we last attempted checkout with
  const lastCheckoutTenantRef = useRef<string | null>(null);
  const lastCheckoutLinesRef = useRef<CheckoutLineInput[] | null>(null);

  const purchase = useMutation(
    trpc.checkout.purchase.mutationOptions({
      onMutate: () => setStates({ success: false, cancel: false }),
      onSuccess: (payload) => {
        window.location.assign(payload.url);
      },
      onError: (err) => {
        const maybeTrpcError = err as unknown;
        const code =
          isTrpcErrorShape(maybeTrpcError) && maybeTrpcError.data?.code
            ? maybeTrpcError.data.code
            : undefined;

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

  const isBusy = purchase.isPending || isFetching;
  const disableResume = !lastCheckoutLinesRef.current || isBusy;

  // When user clicks "Checkout" for a specific seller
  const handleCheckoutGroup = (group: TenantCheckoutGroup) => {
    if (group.products.length === 0) {
      toast.error('No products in this group to checkout');
      return;
    }

    const lines: CheckoutLineInput[] = group.products.map((product) => ({
      productId: String(product.id),
      quantity: readQuantityOrDefault(
        group.quantitiesByProductId[String(product.id)]
      )
    }));

    cartDebug('checkout group tenant selection', {
      groupTenantKey: group.tenantKey,
      groupTenantSlug: group.tenantSlug,
      pageTenantSlug: tenantSlug
    });

    const derivedTenant =
      group.tenantKey ?? group.tenantSlug ?? tenantSlug ?? '__global__';

    lastCheckoutTenantRef.current = derivedTenant;

    lastCheckoutLinesRef.current = lines;

    purchase.mutate({ lines });
  };

  // Handle ?cancel=true (Stripe cancel_url)
  useEffect(() => {
    const isCanceled = searchParams.get('cancel') === 'true';
    if (!isCanceled) return;

    setStates({ cancel: true, success: false });

    const url = new URL(window.location.href);
    url.searchParams.delete('cancel');
    const queryString = url.searchParams.toString();
    router.replace(
      queryString ? `${url.pathname}?${queryString}` : url.pathname,
      { scroll: false }
    );
  }, [router, searchParams, setStates]);

  const clearCartOrAllCarts = async () => {
    try {
      if (tenantSlug && clearCartAsync) {
        // Single-tenant: clear just this tenant’s cart
        await clearCartAsync();
      } else if (clearAllCartsForIdentityAsync) {
        // Multi-tenant: clear all carts for this identity
        await clearAllCartsForIdentityAsync();
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[checkout] clear cart action failed', error);
      }
      toast.error('Failed to clear cart. Please try again.');
    } finally {
      refetch();
      setStates({ cancel: false, success: false });
    }
  };

  // ----- Early-return UIs -----

  if (!mounted || isLoading) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled={disableResume}
            onReturnToCheckoutAction={() => {
              if (!lastCheckoutLinesRef.current) return;
              purchase.mutate({ lines: lastCheckoutLinesRef.current });
            }}
            onDismissAction={() => setStates({ cancel: false, success: false })}
            onClearCartAction={() => {
              void clearCartOrAllCarts();
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

  if (isError) {
    console.error('[CheckoutView] Error loading checkout data', {
      cartError,
      productError
    });

    const message = cartError
      ? `We couldn’t load your cart. Please retry.`
      : productError
        ? `We couldn’t load a product from your cart. Please retry.`
        : `We couldn’t load your cart. Please retry.`;

    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled
            onDismissAction={() => setStates({ cancel: false, success: false })}
            onClearCartAction={() => {
              void clearCartOrAllCarts();
            }}
          />
        )}
        <MessageCard message={message} onRetry={refetch} />
      </div>
    );
  }

  if (!hasAnyItems) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled
            onDismissAction={() => setStates({ cancel: false, success: false })}
            onClearCartAction={() => {
              void clearCartOrAllCarts();
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

  // ----- Main render -----

  return (
    <div className="lg:pt-12 pt-4 px-4 lg:px-12">
      {states.cancel && (
        <CheckoutBanner
          disabled={disableResume}
          onReturnToCheckoutAction={() => {
            if (!lastCheckoutLinesRef.current) return;
            purchase.mutate({ lines: lastCheckoutLinesRef.current });
          }}
          onDismissAction={() => setStates({ cancel: false, success: false })}
          onClearCartAction={() => {
            void clearCartOrAllCarts();
          }}
        />
      )}

      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <TenantCheckoutSection
            key={group.tenantKey}
            group={group}
            isBusy={isBusy}
            onCheckoutAction={handleCheckoutGroup}
          />
        ))}
      </div>
    </div>
  );
};

export default CheckoutView;
