'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCartIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { useCartGlobalSummary } from '@/modules/cart/hooks/use-cart-global-summary';

interface CheckoutButtonProps {
  className?: string;
  hideIfEmpty?: boolean;
}

export const CheckoutButton = ({
  className,
  hideIfEmpty
}: CheckoutButtonProps) => {
  const { cartSummary, badgeCount, isLoading, isError, error } =
    useCartGlobalSummary();

  const [checkoutHref, setCheckoutHref] = useState('/checkout');

  useEffect(() => {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    if (rootDomain) {
      setCheckoutHref(`${window.location.protocol}//${rootDomain}/checkout`);
    }
  }, []);

  useEffect(() => {
    if (isError) {
      console.error('error: ', error);
    }
  }, [isError, error]);

  if (hideIfEmpty && !isLoading && !isError && badgeCount === 0) return null;

  const ariaLabel: string =
    isLoading && !cartSummary
      ? 'Open checkout'
      : `Open checkout${badgeCount ? `, ${badgeCount} item${badgeCount === 1 ? '' : 's'}` : ''}`;

  return (
    <Button asChild variant="elevated" className={cn('bg-white', className)}>
      <Link href={checkoutHref} aria-label={ariaLabel}>
        <ShoppingCartIcon /> {badgeCount > 0 ? badgeCount : ''}
      </Link>
    </Button>
  );
};

export default CheckoutButton;
