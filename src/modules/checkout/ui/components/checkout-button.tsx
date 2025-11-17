'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCartIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { cn, generateTenantURL } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import { Button } from '@/components/ui/button';

import { useCart } from '@/modules/checkout/hooks/use-cart';
import { useCartStore } from '@/modules/checkout/store/use-cart-store';

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

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const persistApi = useCartStore.persist;

    const run = () => {
      const state = useCartStore.getState();

      if (state.currentUserKey.startsWith('anon:')) {
        state.migrateAnonToUser(tenantSlug, userId);
      } else {
        state.setCurrentUserKey?.(userId);
      }
    };

    const unsubscribe = persistApi?.onFinishHydration?.(() => {
      run();
    });

    // If already hydrated when subscription completes, run immediately
    if (persistApi?.hasHydrated?.()) {
      run();
    }

    return () => {
      unsubscribe?.();
    };
  }, [tenantSlug, session?.user?.id]); // 🔍 note: NO `session?.user` here

  const { totalItems } = useCart(tenantSlug, session?.user?.id);

  if (hideIfEmpty && totalItems === 0) return null;

  return (
    <Button asChild variant="elevated" className={cn('bg-white', className)}>
      <Link href={`${generateTenantURL(tenantSlug)}/checkout`}>
        <ShoppingCartIcon /> {totalItems > 0 ? totalItems : ''}
      </Link>
    </Button>
  );
};

export default CheckoutButton;
