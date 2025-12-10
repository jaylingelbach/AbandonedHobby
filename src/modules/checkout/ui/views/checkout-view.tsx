'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { useMutation, useQuery } from '@tanstack/react-query';
import { InboxIcon, LoaderIcon } from 'lucide-react';
import { toast } from 'sonner';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { buildSignInUrl } from '@/lib/utils';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { useTRPC } from '@/trpc/client';

// ─── Project Hooks / Stores ──────────────────────────────────────────────────
import { useCheckoutState } from '@/modules/checkout/hooks/use-checkout-states';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';
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

interface CheckoutViewProps {
  tenantSlug?: string;
}

export const CheckoutView = ({ tenantSlug }: CheckoutViewProps) => {
  const [states, setStates] = useCheckoutState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());

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
      useCartStore
        .getState()
        .removeMissingProductsForCurrentUser(missingProductIds);

      toast.warning(
        'Some items in your cart were removed because they are no longer available.'
      );

      // Refetch to show updated cart without requiring manual retry
      void refetch();
    } else {
      // Fallback if we didn’t get details for some reason
      useCartStore.getState().clearAllCartsForCurrentUser();
      toast.warning('Invalid products found, your cart has been cleared.');
    }
  }, [productError, refetch]);

  const groups = multiData?.groups ?? [];
  const hasAnyItems = groups.length > 0;

  // Track which seller + lines we last attempted checkout with
  const lastCheckoutTenantRef = useRef<string | null>(null);
  const lastCheckoutLinesRef = useRef<CheckoutLineInput[] | null>(null);

  // Helper: stash the scope we actually used for this checkout
  const stashCheckoutScope = useCallback((tenantKeyRaw: string | null) => {
    if (typeof window === 'undefined') return;

    const tenantKey = (tenantKeyRaw ?? '').trim() || '__global__';
    const userKey = useCartStore.getState().currentUserKey;
    const scope = `${tenantKey}::${userKey}`;
    console.log('[cart] stash checkout scope', {
      tenantKey,
      userKey,
      scope
    });

    window.localStorage.setItem('ah_checkout_scope', scope);
  }, []);

  const purchase = useMutation(
    trpc.checkout.purchase.mutationOptions({
      onMutate: () => setStates({ success: false, cancel: false }),
      onSuccess: (payload) => {
        // Use the tenant we actually checked out for
        const scopeTenant =
          lastCheckoutTenantRef.current || tenantSlug || '__global__';

        stashCheckoutScope(scopeTenant);

        cartDebug('redirecting to Stripe (per-tenant checkout)', {
          scopeTenant,
          currentUserKey: useCartStore.getState().currentUserKey,
          stashedScope:
            typeof window !== 'undefined'
              ? window.localStorage.getItem('ah_checkout_scope')
              : null,
          lastLines: lastCheckoutLinesRef.current
        });

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

  useEffect(() => {
    if (!session?.user?.id) return;
    if (!tenantSlug) return;
    const run = () => {
      if (session?.user?.id) {
        useCartStore.getState().migrateAnonToUser(tenantSlug, session.user.id);
      }
    };
    const unsubscribe = useCartStore.persist?.onFinishHydration?.(run);
    if (useCartStore.persist?.hasHydrated?.()) run();
    return () => unsubscribe?.();
  }, [tenantSlug, session?.user?.id]);

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
              useCartStore.getState().clearAllCartsForCurrentUser();
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
              useCartStore.getState().clearAllCartsForCurrentUser();
              setStates({ cancel: false, success: false });
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
              useCartStore.getState().clearAllCartsForCurrentUser();
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
            useCartStore.getState().clearAllCartsForCurrentUser();
            setStates({ cancel: false, success: false });
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
