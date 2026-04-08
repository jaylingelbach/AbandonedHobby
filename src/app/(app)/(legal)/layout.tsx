'use client';

import dynamic from 'next/dynamic';

import { Footer } from '@/modules/home/ui/components/footer';

const Navbar = dynamic(
  () => import('@/modules/home/ui/components/navbar').then((m) => m.Navbar),
  { ssr: false }
);

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 bg-[#F4F4F0]">{children}</div>
      <Footer />
    </div>
  );
}
