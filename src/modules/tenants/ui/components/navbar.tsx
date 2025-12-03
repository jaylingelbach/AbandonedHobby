'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ShoppingCartIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';

import BackToRootLink from '@/components/back-to-root-link';
import { Button } from '@/components/ui/button';
import { generateTenantURL } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

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
      <div className="max-w-(--breakpoint-xl) mx-auto grid grid-cols-3 items-center h-full px-4 lg:px-12">
        <div className="flex items-center">
          <BackToRootLink />
        </div>

        <div className="flex justify-center">
          <Link
            href={generateTenantURL(slug)}
            className="flex items-center gap-2"
          >
            {data.image?.url && (
              <Image
                src={data.image.url}
                width={32}
                height={32}
                alt={slug}
                className="rounded-full border shrink-0 size-8"
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              />
            )}
            <p className="text-xl">{data.name}</p>
          </Link>
        </div>

        <div className="flex justify-end">
          <CheckoutButton tenantSlug={slug} />
        </div>
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
