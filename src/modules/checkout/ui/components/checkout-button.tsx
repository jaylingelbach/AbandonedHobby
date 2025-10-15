import { ShoppingCartIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn, generateTenantURL } from '@/lib/utils';

import { useCart } from '../../hooks/use-cart';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

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
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.session.queryOptions());

  const { totalItems } = useCart(tenantSlug, session?.user?.id);
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
