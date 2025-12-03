import { Navbar } from '@/modules/checkout/ui/components/navbar';
import { Footer } from '@/modules/tenants/ui/components/footer';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Renders the application layout with a top navigation bar, a centered content area for `children`, and a footer.
 *
 * @returns The root JSX element containing the layout structure (Navbar, centered children container, and Footer).
 */
export default async function Layout({ children }: LayoutProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="max-w-(--breakpoint-xl) mx-auto">{children}</div>
      </div>
      <Footer appUrl={appUrl ?? ''} />
    </div>
  );
}