import Link from 'next/link';

import { Poppins } from 'next/font/google';

import { cn } from '@/lib/utils';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['700']
});

export const Footer = () => {
  return (
    <footer className="flex flex-col sm:flex-row border-t justify-between items-center font-medium p-6 gap-4">
      <div className="flex items-center gap-2">
        <p className={cn('text-2xl font-semibold', poppins.className)}>
          abandoned hobby, inc
        </p>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link href="/cookies" className="hover:underline">
          Cookie Policy
        </Link>
      </div>
    </footer>
  );
};
