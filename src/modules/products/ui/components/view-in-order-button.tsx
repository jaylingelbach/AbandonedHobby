import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface Props {
  tenantSlug: string;
  productId: string;
  isPurchased: boolean;
  orderId?: string;
}

export const ViewInOrdersButton = ({ isPurchased, orderId }: Props) => {
  if (isPurchased) {
    const href = orderId ? `/orders/${orderId}` : '/orders';

    return (
      <Button
        variant="elevated"
        asChild
        className="flex-1 font-medium bg-white"
      >
        <Link prefetch href={href}>
          View in orders
        </Link>
      </Button>
    );
  }

  return null;
};

export default ViewInOrdersButton;
