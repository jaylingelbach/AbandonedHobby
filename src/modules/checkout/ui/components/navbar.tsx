import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { generateTenantURL } from '@/lib/utils';
import { HomeIcon } from 'lucide-react';
interface Props {
  slug?: string;
}

export const Navbar = ({ slug }: Props) => {
  return (
    <nav className="h-20 border-b font-medium bg-white">
      <div className="max-w-(--breakpoint-xl) mx-auto flex justify-between items-center h-full px-4 lg:px-12">
        <Link href="/">
          <HomeIcon />
        </Link>
        <p className="text-xl">Checkout</p>
        {slug ? (
          <Button asChild variant="elevated">
            <Link href={generateTenantURL(slug)}>Continue Shopping</Link>
          </Button>
        ) : (
          <Button asChild variant="elevated">
            <Link href="/">Continue Shopping</Link>
          </Button>
        )}
      </div>
    </nav>
  );
};
