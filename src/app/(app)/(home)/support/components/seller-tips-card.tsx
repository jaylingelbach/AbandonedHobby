import { ComponentProps } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SellerTipsCardProps = ComponentProps<typeof Card> & { title?: string };
export default function SellerTipsCard({
  className,
  title = 'Shipping & Returns tips',
  ...props
}: SellerTipsCardProps) {
  return (
    <Card
      className={cn(
        'rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]',
        className
      )}
      {...props}
    >
      <CardHeader>
        <CardTitle className="text-xl font-black" aria-level={3} role="heading">
          {title}
        </CardTitle>

      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="list-disc pl-5">
          <li>Use sturdy boxes; pad corners for heavier gear.</li>
          <li>Always photograph item condition & packing before sealing.</li>
          <li>Add tracking within 3 business days to avoid penalties.</li>
          <li>
            Process refunds within the order page to keep records aligned.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
