import Link from 'next/link';
import { ShoppingCartIcon } from 'lucide-react';

import { cn, generateTenantURL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '../../hooks/use-cart';

interface CheckoutButtonProps {
  className?: string;
  hideIfEmpty?: boolean;
  tenantSlug: string;
}

export const CheckoutButton = ({
  className,
  tenantSlug,
  hideIfEmpty
}: CheckoutButtonProps) => {
  const { totalItems } = useCart(tenantSlug);
  if (hideIfEmpty && totalItems === 0) return null;
  return (
    <Button
      asChild
      variant="elevated"
      className={cn('bg-white', className)}
      onClick={() => {}}
    >
      <Link href={`${generateTenantURL(tenantSlug)}/checkout`}>
        <ShoppingCartIcon /> {totalItems > 0 ? totalItems : ''}
      </Link>
    </Button>
  );
};

export default CheckoutButton;
