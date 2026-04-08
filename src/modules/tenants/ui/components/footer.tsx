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
      <div className="max-w-(--breakpoint-xl) mx-auto flex flex-col items-center gap-4 h-full px-4 py-6 lg:px-12 md:flex-row md:justify-between">
        <div className="flex items-center gap-2 text-center md:text-left">
          <p>Powered by:</p>
          <Link href={appUrl} aria-label="Go to Abandoned Hobbies homepage">
            <span className={cn('text-2xl font-semibold', poppins.className)}>
              abandoned hobby, inc
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            href={`${appUrl}/terms`}
            className="hover:underline focus:underline focus:outline-none"
          >
            Terms of Service
          </Link>
          <Link
            href={`${appUrl}/privacy`}
            className="hover:underline focus:underline focus:outline-none"
          >
            Privacy Policy
          </Link>
          <Link
            href={`${appUrl}/cookies`}
            className="hover:underline focus:underline focus:outline-none"
          >
            Cookie Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};
