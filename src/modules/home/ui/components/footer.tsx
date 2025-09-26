import { Poppins } from 'next/font/google';

import { cn } from '@/lib/utils';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['700']
});

export const Footer = () => {
  return (
    <footer className="flex border-t justify-between font-medium p-6">
      <div className="flex items-center gap-2">
        <p className={cn('text-2xl font-semibold', poppins.className)}>
          abandoned hobby, inc
        </p>
      </div>
    </footer>
  );
};
