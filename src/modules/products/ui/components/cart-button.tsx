import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCart } from '@/modules/checkout/hooks/use-cart';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

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
    const state = useCartStore.getState();
    const isAnon = state.currentUserKey.startsWith('anon:');
    if (isAnon) state.migrateAnonToUser(tenantSlug, session.user.id);
  }, [tenantSlug, session?.user?.id]);

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
