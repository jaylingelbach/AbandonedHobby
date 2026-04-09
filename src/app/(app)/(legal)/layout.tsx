'use client';

import dynamic from 'next/dynamic';

import { Footer } from '@/modules/home/ui/components/footer';

const Navbar = dynamic(
  () => import('@/modules/home/ui/components/navbar').then((m) => m.Navbar),
  { ssr: false }
);

/**
 * Layout component for legal pages that provides a consistent page frame.
 *
 * Renders a full-height vertical column with a navbar at the top, a main content area that hosts `children`, and a footer at the bottom.
 *
 * @param children - The content to render inside the main area of the layout
 * @returns A JSX element containing the navbar, the `children` within the main content area, and the footer
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 bg-[#F4F4F0]">{children}</div>
      <Footer />
    </div>
  );
}
