import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '@/modules/checkout/hooks/use-cart';
import Link from 'next/link';

interface Props {
  tenantSlug: string;
  productId: string;
  isPurchased: boolean;
  orderId?: string;
}

export const CartButton = ({
  tenantSlug,
  productId,
  isPurchased,
  orderId
}: Props) => {
  const cart = useCart(tenantSlug);

  if (isPurchased) {
    // ✅ Always use absolute paths so we don’t inherit the tenant/product route
    const href = orderId ? `/orders/${orderId}` : '/orders';

    return (
      <Button
        variant="elevated"
        asChild
        className="flex-1 font-medium bg-white"
      >
        <Link prefetch href={href}>
          View in orders
        </Link>
      </Button>
    );
  }

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
