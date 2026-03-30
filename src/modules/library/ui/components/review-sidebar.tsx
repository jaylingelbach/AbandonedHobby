import { useSuspenseQuery } from '@tanstack/react-query';

import { useTRPC } from '@/trpc/client';

import { ReviewForm } from './review-form';

interface Props {
  productId: string;
  orderId: string;
}

export const ReviewSidebar = ({ productId, orderId }: Props) => {
  // get review
  const trpc = useTRPC();
  // everytime you use useSuspenseQuery you have to have a matching prefetch. This is in [productId]/Page.tsx
  const { data } = useSuspenseQuery(
    trpc.reviews.getOne.queryOptions({
      productId,
      orderId
    })
  );

  return <ReviewForm productId={productId} initialData={data} />;
};

export default ReviewSidebar;
