import { Poppins } from 'next/font/google';
import Link from 'next/link';

import { cn } from '@/lib/utils';

interface FooterProps {
  appUrl: string;
}

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['700']
});

export const Footer = ({ appUrl }: FooterProps) => {
  return (
    <footer className="border-t  font-medium bg-white">
      <div className="max-w-(--breakpoint-xl) mx-auto flex items-center h-full px-4 py-6 lg:px-12 gap-2 ">
        <p>Powered by:</p>
        <Link href={appUrl} aria-label="Go to Abandoned Hobbies homepage">
          <span className={cn('text-2xl font-semibold', poppins.className)}>
            abandoned hobby, inc
          </span>
        </Link>
      </div>
    </footer>
  );
};
