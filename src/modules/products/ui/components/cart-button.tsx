'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import { Button } from '@/components/ui/button';

import { useCart } from '@/modules/checkout/hooks/use-cart';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';
import { ShippingMode } from '@/modules/orders/types';

interface Props {
  tenantSlug: string;
  productId: string;
  isPurchased: boolean;
  orderId?: string;
  shippingMode?: 'free' | 'flat' | 'calculated';
  shippingFeeCentsPerUnit?: number;
}
const CartButton = ({
  tenantSlug,
  productId,
  shippingMode,
  shippingFeeCentsPerUnit
}: Props) => {
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());

  const cart = useCart(tenantSlug, session?.user?.id);

  const normalized = useMemo(() => {
    const mode: ShippingMode =
      shippingMode === 'flat' || shippingMode === 'calculated'
        ? shippingMode
        : 'free';

    // Round to nearest cent and clamp to non-negative integer
    const fee =
      typeof shippingFeeCentsPerUnit === 'number' &&
      Number.isFinite(shippingFeeCentsPerUnit)
        ? Math.max(0, Math.round(shippingFeeCentsPerUnit))
        : 0;

    return { mode, fee };
  }, [shippingMode, shippingFeeCentsPerUnit]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const run = () => {
      const state = useCartStore.getState();
      if (state.currentUserKey.startsWith('anon:')) {
        state.migrateAnonToUser(tenantSlug, userId);
      } else {
        state.setCurrentUserKey?.(userId);
      }
    };
    const unsubscribe = useCartStore.persist?.onFinishHydration?.(run);
    if (useCartStore.persist?.hasHydrated?.()) run();
    return () => unsubscribe?.();
  }, [tenantSlug, session?.user?.id]);

  const isInCart = cart.isProductInCart(productId);

  return (
    <Button
      variant="elevated"
      className={cn('flex-1 bg-pink-400', isInCart && 'bg-white')}
      onClick={() => {
        // Write shipping snapshot before toggling
        useCartStore
          .getState()
          .setProductShippingSnapshot(
            tenantSlug,
            productId,
            normalized.mode,
            normalized.fee
          );

        cart.toggleProduct(productId);
      }}
    >
      {isInCart ? 'Remove from cart' : 'Add to cart'}
    </Button>
  );
};

export default CartButton;
