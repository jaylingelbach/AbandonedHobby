import '@/app/(app)/globals.css';

export const metadata = {
  title: { default: 'Abandoned Hobby', template: '%s — Abandoned Hobby' },
  description: 'Buy, sell, and trade hobby gear.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#F4F4F0] text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
