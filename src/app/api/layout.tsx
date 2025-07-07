export const metadata = {
  title: 'Abandoned Hobby',
  description:
    'A safe place for ADHD people to trade, buy and sell their hobbies judgement free'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
