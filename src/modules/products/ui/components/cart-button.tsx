'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { useServerCart } from '@/modules/cart/hooks/use-server-cart';

interface Props {
  tenantSlug: string;
  productId: string;
  quantity: number;
}
export const CartButton = ({ tenantSlug, productId, quantity }: Props) => {
  const { cart, removeItem, setQuantity, isSettingQuantity, isRemovingItem } =
    useServerCart(tenantSlug);

  const items = cart?.items ?? [];
  const line = items.find((item) => item.productId === productId);
  const isInCart = Boolean(line);

  const effectiveQuantity = readQuantityOrDefault(quantity, 1);

  return (
    <Button
      variant="elevated"
      className={cn('flex-1 bg-pink-400', isInCart && 'bg-white')}
      onClick={() => {
        if (isSettingQuantity || isRemovingItem) return;
        if (isInCart) removeItem(productId);
        else setQuantity(productId, effectiveQuantity);
      }}
      disabled={isSettingQuantity || isRemovingItem}
    >
      {isInCart ? 'Remove from cart' : 'Add to cart'}
    </Button>
  );
};
