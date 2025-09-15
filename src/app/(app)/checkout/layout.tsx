export const metadata = {
  title: 'Checkout - Abandoned Hobby',
  description: 'Complete your purchase on Abandoned Hobby marketplace'
};

/**
 * Layout component for the Checkout route that renders its children unchanged.
 *
 * @param children - React nodes to render inside the checkout layout (passed through as-is).
 * @returns The `children` wrapped in a fragment.
 */
export default function CheckoutLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
