'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import { Button } from '@/components/ui/button';

import { useCartStore } from '@/modules/checkout/store/use-cart-store';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { useServerCart } from '@/modules/cart/hooks/use-server-cart';

interface Props {
  tenantSlug: string;
  productId: string;
  quantity: number;
}
export const CartButton = ({ tenantSlug, productId, quantity }: Props) => {
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());
  const { cart, removeItem, setQuantity, isSettingQuantity } =
    useServerCart(tenantSlug);

  const items = cart?.items ?? [];
  const line = items.find((item) => item.productId === productId);
  const isInCart = Boolean(line);

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
        if (isInCart) removeItem(productId);
        else setQuantity(productId, effectiveQuantity);
      }}
      disabled={isSettingQuantity}
    >
      {isInCart ? 'Remove from cart' : 'Add to cart'}
    </Button>
  );
};
