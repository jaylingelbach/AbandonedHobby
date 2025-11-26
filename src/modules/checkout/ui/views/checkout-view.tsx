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
import { useCheckoutState } from '../../hooks/use-checkout-states';
import { useCartStore } from '../../store/use-cart-store';
import { cartDebug } from '../../debug';

// ─── Project Components ──────────────────────────────────────────────────────
import CheckoutBanner from './checkout-banner';
import TenantCheckoutSection from './tenant-checkout-section';

// ─── New multi-tenant hook/types ─────────────────────────────────────────────
import {
  TenantCheckoutGroup,
  useMultiTenantCheckoutData
} from '../../hooks/use-multi-tenant-checkout-data';
import { CheckoutLineInput } from '@/lib/validation/seller-order-validation-types';

interface CheckoutViewProps {
  tenantSlug?: string;
}

type TrpcErrorShape = { data?: { code?: string } };

function isTrpcErrorShape(value: unknown): value is TrpcErrorShape {
  if (typeof value !== 'object' || value === null) return false;
  if (!('data' in value)) return true; // allow absence of data
  const data = (value as { data?: unknown }).data;
  return data === undefined || data === null || typeof data === 'object';
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
    error,
    refetch
  } = useMultiTenantCheckoutData();

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

  // Clear cart(s) if server says products are invalid
  useEffect(() => {
    if (!error) return;

    const maybeTrpcError = error as unknown;
    const code =
      isTrpcErrorShape(maybeTrpcError) && maybeTrpcError.data?.code
        ? maybeTrpcError.data.code
        : undefined;

    if (code === 'NOT_FOUND') {
      // TODO: backend should return { tenantSlug, missingProductIds }
      // so we can clear only the affected tenant / products instead of nuking
      // all carts for this user.
      useCartStore.getState().clearAllCartsForCurrentUser();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error]);

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
            onReturnToCheckout={() => {
              if (!lastCheckoutLinesRef.current) return;
              purchase.mutate({ lines: lastCheckoutLinesRef.current });
            }}
            onDismiss={() => setStates({ cancel: false, success: false })}
            onClearCart={() => {
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
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled
            onDismiss={() => setStates({ cancel: false, success: false })}
            onClearCart={() => {
              useCartStore.getState().clearAllCartsForCurrentUser();
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

  if (!hasAnyItems) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        {states.cancel && (
          <CheckoutBanner
            disabled
            onDismiss={() => setStates({ cancel: false, success: false })}
            onClearCart={() => {
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
          onReturnToCheckout={() => {
            if (!lastCheckoutLinesRef.current) return;
            purchase.mutate({ lines: lastCheckoutLinesRef.current });
          }}
          onDismiss={() => setStates({ cancel: false, success: false })}
          onClearCart={() => {
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
