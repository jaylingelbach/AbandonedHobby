import { Footer } from '@/modules/tenants/ui/components/footer';
import { Navbar } from '@/modules/checkout/ui/components/navbar';

interface LayoutProps {
  children: React.ReactNode;
  params: { slug: string };
}

export default function Layout({ children, params }: LayoutProps) {
  const { slug } = params;

  return (
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col">
      <Navbar slug={slug} />
      <div className="flex-1">
        <div className="max-w-(--breakpoint-xl) mx-auto">{children}</div>
      </div>
      <Footer />
    </div>
  );
}
