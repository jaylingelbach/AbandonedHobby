'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect } from 'react';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';

// ─── Project Hooks / Stores ──────────────────────────────────────────────────
import { useCart } from '@/modules/checkout/hooks/use-cart';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';

interface Props {
  tenantSlug: string;
  productId: string;
  isPurchased: boolean;
  orderId?: string;
}

export const CartButton = ({ tenantSlug, productId }: Props) => {
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());

  const cart = useCart(tenantSlug, session?.user?.id);

  useEffect(() => {
    if (!session?.user?.id) return;

    const run = () => {
      const state = useCartStore.getState();
      if (state.currentUserKey.startsWith('anon:')) {
        if (session.user) {
          state.migrateAnonToUser(tenantSlug, session.user.id);
        }
      } else {
        if (session.user) {
          state.setCurrentUserKey?.(session.user.id);
        }
      }
    };
    // hydrate-safe
    const unsub = useCartStore.persist?.onFinishHydration?.(run);
    if (useCartStore.persist?.hasHydrated?.()) run();
    return () => unsub?.();
  }, [tenantSlug, session?.user?.id, session?.user]);

  return (
    <Button
      variant="elevated"
      className={cn(
        'flex-1 bg-pink-400',
        cart.isProductInCart(productId) && 'bg-white'
      )}
      onClick={() => cart.toggleProduct(productId)}
    >
      {cart.isProductInCart(productId) ? 'Remove from cart' : 'Add to cart'}
    </Button>
  );
};

export default CartButton;
