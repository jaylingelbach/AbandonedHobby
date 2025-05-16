'use client';

import dynamic from 'next/dynamic';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';

import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { generateTenantURL } from '@/lib/utils';
import { ShoppingCartIcon } from 'lucide-react';

const CheckoutButton = dynamic(
  () =>
    import('@/modules/checkout/ui/components/checkout-button').then((mod) => ({
      default: mod.CheckoutButton
    })),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="bg-white">
        <ShoppingCartIcon className="text-black" />
      </Button>
    )
  }
); // doing this to solve hydration errors while using local storage.

interface Props {
  slug: string;
}

export const Navbar = ({ slug }: Props) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.tenants.getOne.queryOptions({
      slug
    })
  );

  return (
    <nav className="h-20 border-b font-medium bg-white">
      <div className="max-w-(--breakpoint-xl) mx-auto flex justify-between items-center h-full px-4 lg:px-12">
        <Link
          href={generateTenantURL(slug)}
          className="flex items-center gap-2"
        >
          {data.image?.url && (
            <Image
              src={
                typeof data.image === 'object' && data.image?.url
                  ? data.image.url
                  : ''
              }
              width={32}
              height={32}
              alt={slug}
              className="rounded-full border shrink-0 size-[32px]"
            />
          )}
        </Link>
        <p className="text-xl">{data.name} </p>
        <CheckoutButton tenantSlug={slug} />
      </div>
    </nav>
  );
};

export const NavbarSkeleton = () => {
  return (
    <nav className="h-20 border-b font-medium bg-white">
      <div className="max-w-(--breakpoint-xl) mx-auto flex justify-between items-center h-full px-4 lg:px-12">
        <Button disabled className="bg-white">
          <ShoppingCartIcon className="text-black" />
        </Button>
        <div />
      </div>
    </nav>
  );
};
