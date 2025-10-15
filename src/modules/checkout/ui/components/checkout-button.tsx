'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect } from 'react';
import Link from 'next/link';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { ShoppingCartIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn, generateTenantURL } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';

// ─── Project Hooks / Stores ──────────────────────────────────────────────────
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

    const unsub = useCartStore.persist?.onFinishHydration?.(run);
    if (useCartStore.persist?.hasHydrated?.()) run();
    return () => unsub?.();
  }, [tenantSlug, session?.user?.id]);

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
