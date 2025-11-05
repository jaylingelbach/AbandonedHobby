'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InboxIcon, LoaderIcon } from 'lucide-react';
import { toast } from 'sonner';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { track } from '@/lib/analytics';
import {
  buildSignInUrl,
  generateTenantURL,
  getPrimaryCardImageUrl,
  getTenantNameSafe,
  getTenantSlugSafe
} from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import { calculateShippingAmount } from '../../utils/calculate-shipping-amount';

// ─── Project Types ───────────────────────────────────────────────────────────
import type { Product } from '@/payload-types';
import type {
  CartItemForShipping,
  SidebarShippingLine
} from '@/modules/orders/types';

// ─── Project Hooks / Stores ──────────────────────────────────────────────────
import { useCart } from '../../hooks/use-cart';
import { useCheckoutState } from '../../hooks/use-checkout-states';
import { useCartStore } from '../../store/use-cart-store';
import { buildScopeClient } from '@/modules/checkout/hooks/cart-scope';
import { cartDebug } from '../../debug';

// ─── Project Components ──────────────────────────────────────────────────────
import CheckoutBanner from './checkout-banner';
import CheckoutSidebar from '../components/checkout-sidebar';
import { CheckoutItem } from '../components/checkout-item';
import { toProductWithShipping } from '../../utils/to-product-with-shipping';

interface CheckoutViewProps {
  tenantSlug: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = useQuery(trpc.auth.session.queryOptions());

  const { productIds, removeProduct, clearCart } = useCart(
    tenantSlug,
    session?.user?.id
  );

  // Build query options once for stable keys
  const productsQueryOptions = useMemo(
    () => trpc.checkout.getProducts.queryOptions({ ids: productIds }),
    [trpc.checkout.getProducts, productIds]
  );

  // Load products in cart (localStorage-driven, so no SSR/hydration needed)
  const { data, error, isLoading, isFetching, isError, refetch } = useQuery({
    ...productsQueryOptions,
    enabled: productIds.length > 0,
    placeholderData: (previous) => previous,
    retry: 1
  });

  const libraryFilter = useMemo(
    () => trpc.library.getMany.infiniteQueryFilter(),
    [trpc.library.getMany]
  );

  const purchase = useMutation(
    trpc.checkout.purchase.mutationOptions({
      onMutate: () => setStates({ success: false, cancel: false }),
      onSuccess: (payload) => {
        const scope = buildScopeClient(tenantSlug, session?.user?.id);
        localStorage.setItem('ah_checkout_scope', scope);
        cartDebug('redirecting to Stripe', {
          tenantSlug,
          userId: session?.user?.id ?? null,
          stashedScope: scope,
          currentProductIds: productIds
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

  // Single flag for disabling “Return to checkout”
  const isBusy = purchase.isPending || isFetching;
  const disableResume = productIds.length === 0 || isBusy;

  // ---- HOISTED MEMOS (before any early returns) ----

  // Stable docs array for downstream memos and maps
  const docs = useMemo<Product[]>(
    () => (Array.isArray(data?.docs) ? (data.docs as Product[]) : []),
    [data]
  );

  // Subtotal (cents) derived once; works for older or newer server responses
  const subtotalCents = useMemo(() => {
    if (typeof data?.subtotalCents === 'number') return data.subtotalCents;
    if (typeof data?.totalCents === 'number') return data.totalCents;
    const totalPriceDollars =
      (data as { totalPrice?: number } | undefined)?.totalPrice ?? 0;
    return Math.round(totalPriceDollars * 100);
  }, [data]);

  const shippingCents = useMemo(
    () => (typeof data?.shippingCents === 'number' ? data.shippingCents : 0),
    [data]
  );

  const totalCents = useMemo(() => {
    if (typeof data?.totalCents === 'number') return data.totalCents;
    return subtotalCents + shippingCents;
  }, [data, subtotalCents, shippingCents]);

  // 1) Build display lines (keeps 'calculated', drops only 'free')
  const itemizedShippingLines = useMemo<SidebarShippingLine[]>(
    () =>
      docs
        .map((product) => {
          const normalized = toProductWithShipping(product);
          const shippingMode = normalized?.shippingMode ?? 'free';
          const amountCents = normalized
            ? calculateShippingAmount(normalized)
            : 0;

          return {
            id: String(product.id),
            label: typeof product.name === 'string' ? product.name : 'Item',
            amountCents,
            mode: shippingMode
          };
        })
        .filter((line) => line.mode !== 'free'),
    [docs]
  );

  const hasCalculatedShipping = useMemo(
    () => itemizedShippingLines.some((line) => line.mode === 'calculated'),
    [itemizedShippingLines]
  );

  // 2) Transform to CartItemForShipping[] (wire quantity here; currently 1)
  const breakdownItems = useMemo<CartItemForShipping[]>(
    () =>
      itemizedShippingLines.map((line) => ({
        id: line.id,
        name: line.label,
        quantity: 1, // TODO: replace with real quantity when cart supports it
        shippingMode: line.mode,
        shippingFeeCentsPerUnit:
          line.mode === 'flat' ? line.amountCents : undefined
      })),
    [itemizedShippingLines]
  );

  // ---- Effects (safe; hooks already called above) ----

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

  // Clear cart if server says products are invalid
  useEffect(() => {
    const maybeTrpcError = error as unknown;
    const code =
      isTrpcErrorShape(maybeTrpcError) && maybeTrpcError.data?.code
        ? maybeTrpcError.data.code
        : undefined;

    if (code === 'NOT_FOUND') {
      clearCart();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error, clearCart]);

  // Success flow (after returning from success_url)
  useEffect(() => {
    if (!states.success) return;

    setStates({ success: false, cancel: false });
    clearCart();

    queryClient.invalidateQueries(libraryFilter);
    router.push('/orders');
  }, [
    states.success,
    clearCart,
    router,
    setStates,
    queryClient,
    libraryFilter
  ]);

  // Session success handling (?success=true or ?session_id=...)
  useEffect(() => {
    const isSuccess =
      searchParams.get('success') === 'true' ||
      !!searchParams.get('session_id');
    if (!isSuccess) return;

    const scope =
      typeof window !== 'undefined'
        ? localStorage.getItem('ah_checkout_scope')
        : null;

    const run = () => {
      if (scope) {
        useCartStore.getState().clearCartForScope(scope);
        localStorage.removeItem('ah_checkout_scope');
      } else {
        clearCart();
      }

      setStates({ success: false, cancel: false });

      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('session_id');
      const queryString = url.searchParams.toString();
      router.replace(
        queryString ? `${url.pathname}?${queryString}` : url.pathname,
        { scroll: false }
      );

      queryClient.invalidateQueries(libraryFilter);
    };

    const unsubscribe = useCartStore.persist?.onFinishHydration?.(run);
    if (useCartStore.persist?.hasHydrated?.()) run();
    return () => unsubscribe?.();
  }, [searchParams, clearCart, router, setStates, queryClient, libraryFilter]);

  // ---- Analytics: checkout_canceled on page load with cancel=true ----
  const sentCancelEventRef = useRef(false);
  useEffect(() => {
    if (!states.cancel || sentCancelEventRef.current) return;

    const itemCount = productIds.length;
    const cartTotalCents =
      typeof data?.totalCents === 'number'
        ? data.totalCents
        : Math.round(
            ((data as { totalPrice?: number } | undefined)?.totalPrice ?? 0) *
              100
          );

    const userType = session?.user ? 'auth' : 'guest';

    track('checkout_canceled', {
      tenantSlug,
      itemCount,
      cartTotalCents,
      userType
    });

    sentCancelEventRef.current = true;
  }, [states.cancel, data, productIds.length, tenantSlug, session?.user]);

  // Migrate cart scope once user logs in
  useEffect(() => {
    if (!session?.user?.id) return;
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

  if (productIds.length === 0 || (data && data.totalDocs === 0)) {
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
            {docs.map((product, index) => {
              const imageURL =
                (product as { cardImageUrl?: string | null }).cardImageUrl ??
                getPrimaryCardImageUrl(product);

              const tenantSlugSafe = getTenantSlugSafe(product.tenant);
              const tenantNameSafe =
                getTenantNameSafe(product.tenant) ?? 'Shop';

              const productURL = tenantSlugSafe
                ? `${generateTenantURL(tenantSlugSafe)}/products/${product.id}`
                : `/products/${product.id}`;

              const tenantURL = tenantSlugSafe
                ? `${generateTenantURL(tenantSlugSafe)}`
                : '#';

              return (
                <CheckoutItem
                  key={product.id}
                  isLast={index === docs.length - 1}
                  imageURL={imageURL ?? undefined}
                  name={product.name}
                  productURL={productURL}
                  tenantURL={tenantURL}
                  tenantName={tenantNameSafe}
                  price={product.price}
                  onRemove={() => removeProduct(product.id)}
                />
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3">
          <CheckoutSidebar
            subtotalCents={subtotalCents}
            shippingCents={shippingCents}
            totalCents={totalCents}
            onPurchaseAction={() => purchase.mutate({ productIds })}
            isCanceled={states.cancel}
            disabled={isBusy}
            hasCalculatedShipping={hasCalculatedShipping}
            breakdownItems={breakdownItems}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutView;
