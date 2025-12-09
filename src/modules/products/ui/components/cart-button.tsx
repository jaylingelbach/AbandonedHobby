'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import { Button } from '@/components/ui/button';

import { useCartStore } from '@/modules/checkout/store/use-cart-store';
import { ShippingMode } from '@/modules/orders/types';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { useServerCart } from '@/modules/cart/hooks/use-server-cart';

interface Props {
  tenantSlug: string;
  productId: string;
  shippingMode?: 'free' | 'flat' | 'calculated';
  shippingFeeCentsPerUnit?: number;
  quantity: number;
}
export const CartButton = ({
  tenantSlug,
  productId,
  shippingMode,
  shippingFeeCentsPerUnit,
  quantity
}: Props) => {
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());
  const { cart, removeItem, setQuantity, isSettingQuantity, isRemovingItem } =
    useServerCart(tenantSlug);

  const items = cart?.items ?? [];
  const line = items.find((item) => item.productId === productId);
  const isInCart = Boolean(line);

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

  const effectiveQuantity = readQuantityOrDefault(quantity, 1);

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

  return (
    <Button
      variant="elevated"
      className={cn('flex-1 bg-pink-400', isInCart && 'bg-white')}
      onClick={() => {
        useCartStore
          .getState()
          .setProductShippingSnapshot(
            tenantSlug,
            productId,
            normalized.mode,
            normalized.fee
          );
        isInCart
          ? removeItem(productId)
          : setQuantity(productId, effectiveQuantity);
      }}
      disabled={isSettingQuantity || isRemovingItem}
    >
      {isInCart ? 'Remove from cart' : 'Add to cart'}
    </Button>
  );
};
