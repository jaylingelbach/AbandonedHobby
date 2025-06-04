import { Suspense } from 'react';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient, trpc } from '@/trpc/server';

import { Footer } from '@/modules/tenants/ui/components/footer';
import { Navbar, NavbarSkeleton } from '@/modules/tenants/ui/components/navbar';

interface LayoutProps {
  children: React.ReactNode;
  params: { slug: string };
}

export default async function Layout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  console.log('💡 appUrl from layout:', appUrl); // add this to debug

  /* ── pre-fetch tenant data on the server ─────────────────────────────── */
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.tenants.getOne.queryOptions({ slug }));

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <HydrationBoundary state={dehydrate(queryClient)}>
        {/* Navbar is a client component that *can* use the hook */}
        <Suspense fallback={<NavbarSkeleton />}>
          <Navbar slug={slug} />
        </Suspense>
      </HydrationBoundary>

      <div className="flex-1">
        <div className="max-w-(--breakpoint-xl) mx-auto">{children}</div>
      </div>

      <Footer appUrl={appUrl ?? ''} />
    </div>
  );
}
