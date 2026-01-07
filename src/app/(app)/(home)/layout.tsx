'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

import { Footer } from '@/modules/home/ui/components/footer';
import { SearchFiltersLoading } from '@/modules/home/ui/components/search-filters';

const Navbar = dynamic(
  () => import('@/modules/home/ui/components/navbar').then((m) => m.Navbar),
  {
    ssr: false
  }
);

const SearchFilters = dynamic(
  () =>
    import('@/modules/home/ui/components/search-filters').then(
      (m) => m.SearchFilters
    ),
  { ssr: false, loading: () => <SearchFiltersLoading /> }
);

interface Props {
  children: React.ReactNode;
}

/**
 * Page layout component that renders the site chrome and hosts page content.
 *
 * @param children - Content to be displayed in the layout's main content area.
 * @returns The composed layout element containing the navigation, main content area, and footer.
 */
export default function Layout({ children }: Props) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <Suspense fallback={<SearchFiltersLoading />}>
        <SearchFilters />
      </Suspense>
      <div className="flex-1 bg-[#F4F4F0]">{children}</div>
      <Footer />
    </div>
  );
}