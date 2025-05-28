'use client';

import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';

import { CheckCheckIcon, LinkIcon, StarIcon } from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';

import { formatCurrency, generateTenantURL } from '@/lib/utils';
import StarRating from '@/components/star-rating';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';

const CartButton = dynamic(
  () => import('../cart-button').then((mod) => ({ default: mod.CartButton })),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="flex-1 bg-pink-400">
        Add to cart
      </Button>
    )
  }
); // doing this to solve hydration errors while using local storage.

interface ProductRatingsBreakdownProps {
  ratings: Array<{ stars: number; percentage: number }>;
}

const ProductRatingsBreakdown = ({ ratings }: ProductRatingsBreakdownProps) => (
  <div className="grid grid-cols-[auto_1fr_auto] gap-3 mt-4">
    {ratings.map(({ stars, percentage }) => (
      <Fragment key={stars}>
        <div className="font-medium">
          {stars} {stars === 1 ? 'star' : 'stars'}
        </div>
        <Progress value={percentage} className="h-[1lh]" />
        <div className="font-medium">{percentage}%</div>
      </Fragment>
    ))}
  </div>
);

interface ProductViewProps {
  productId: string;
  tenantSlug: string;
}

export const ProductView = ({ productId, tenantSlug }: ProductViewProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.products.getOne.queryOptions({
      id: productId
    })
  );

  const [isCopied, setIsCopied] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  return (
    <div className="px-4 lg:px-12 py-10">
      <div className="border rounded-sm bg-white overflow-hidden">
        <div className="relative aspect-[3.9] border-b">
          <Image
            src={data.cover?.url || '/placeholder.png'}
            alt={data.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-6">
          <div className="col-span-4">
            {/* Product name */}
            <div className="p-6">
              <h1 className="text-4xl font-medium ">{data.name}</h1>
            </div>
            {/* Holds price, shop and ratings */}
            <div className="border-y flex">
              {/* Price */}
              <div className="px-6 py-4 flex items-center justify-center border-r">
                <div className="px-2 py-1 border bg-pink-400 w-fit">
                  <p className="text-base font-medium">
                    {formatCurrency(data.price)}
                  </p>
                </div>
              </div>
              {/* Shop name */}
              <div className="px-6 py-4 flex items-center justify-center lg:border-r">
                <Link
                  href={generateTenantURL(tenantSlug)}
                  className="flex items-center gap-2"
                >
                  {data.tenant.image?.url && (
                    <Image
                      src={data.tenant.image?.url}
                      alt={data.tenant.name}
                      width={20}
                      height={20}
                      className="rounded-full border shrink-0 size-[20px]"
                    />
                  )}
                  <p className="text-base underline font-medium">
                    {data.tenant.name}
                  </p>
                </Link>
              </div>
              {/* Shop Rating? */}
              <div className="hidden lg:flex px-6 py-4 items-center justify-center">
                <div className="flex items-center gap-2">
                  <StarRating rating={data.reviewRating} />
                  <p className="text-base font-medium">
                    {data.reviewCount} ratings
                  </p>
                </div>
              </div>
            </div>
            {/* Mobile hidden on desktop */}
            <div className="block lg:hidden px-6 py-4 items-center">
              <div className="flex items-center gap-2 ">
                <StarRating rating={data.reviewRating} iconClassName="size-4" />
                <p className="text-base font-medium">
                  {data.reviewCount} ratings
                </p>
              </div>
            </div>
            {/* Product Description */}
            <div className="p-6">
              {data.description ? (
                <p>{data.description}</p>
              ) : (
                <p className="font-medium text-muted-foreground italic">
                  No description provided
                </p>
              )}
            </div>
          </div>
          <div className="col-span-2">
            {/* Div around add to cart and ratings */}
            <div className="border-t lg:border-t-0 lg:border-l h-full">
              {/* Add to cart */}
              <div className="flex flex-col gap-4 p-6 border-b">
                <div className="flex flex-row items-center gap-2">
                  <CartButton
                    isPurchased={data.isPurchased}
                    tenantSlug={tenantSlug}
                    productId={productId}
                  />
                  <Button
                    className="size-12"
                    variant="elevated"
                    onClick={async () => {
                      try {
                        setIsCopied(true);
                        await navigator.clipboard.writeText(
                          window.location.href
                        );
                        toast.success('URL copied to clipboard');
                        timeoutRef.current = setTimeout(
                          () => setIsCopied(false),
                          1000
                        );
                      } catch (error) {
                        setIsCopied(false);
                        toast.error('Failed to copy URL to clipboard');
                      }
                    }}
                    disabled={isCopied}
                  >
                    {isCopied ? <CheckCheckIcon /> : <LinkIcon />}
                  </Button>
                </div>
                <p className="text-center font-medium">
                  {data.refundPolicy === 'no refunds'
                    ? 'No refunds'
                    : `${data.refundPolicy} money back guarantee`}
                </p>
              </div>
              {/* Ratings */}
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-medium">Ratings</h3>
                  <div className="flex items-center gap-x-1 font-medium">
                    <StarIcon className="size-4 fill-black" />
                    <p>({data.reviewRating})</p>
                    <p className="text-based">{data.reviewCount} ratings</p>
                  </div>
                </div>
                {/* % of customers that give specific rating via progress bar */}
                <ProductRatingsBreakdown
                  ratings={[5, 4, 3, 2, 1].map((stars) => ({
                    stars,
                    percentage: Number(data.ratingDistribution[stars])
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
