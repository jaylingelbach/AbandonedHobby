'use client';

import { RichText } from '@payloadcms/richtext-lexical/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CheckCheckIcon, LinkIcon, StarIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import StarRating from '@/components/star-rating';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useProductViewed } from '@/hooks/analytics/use-product-viewed';
import { useUser } from '@/hooks/use-user';
import { formatCurrency, generateTenantURL } from '@/lib/utils';
import { ChatButtonWithModal } from '@/modules/conversations/ui/chat-button-with-modal';
import { useTRPC } from '@/trpc/client';

import ProductGallery from '../components/product-gallery';
import ViewInOrdersButton from '../components/view-in-order-button';
import { mapProductImagesFromPayload } from '../utils/product-gallery-mappers';

const CartButton = dynamic(
  () =>
    import('../components/cart-button').then((mod) => ({
      default: mod.CartButton
    })),
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
    trpc.products.getOne.queryOptions({ id: productId })
  );

  const { user } = useUser();

  const isSelf = !!(
    user?.tenants?.some((t) =>
      typeof t.tenant === 'string'
        ? t.tenant === data.tenant?.id
        : t.tenant?.id === data.tenant?.id
    ) || data.tenant?.primaryContact === user?.id
  );

  // Defensive availability derivation (works with or without server-computed fields)
  const trackInventory =
    (data as { trackInventory?: unknown })?.trackInventory === true;
  const stockQuantityRaw = (data as { stockQuantity?: unknown })?.stockQuantity;
  const stockQuantity =
    typeof stockQuantityRaw === 'number' ? stockQuantityRaw : 0;

  const inStock =
    (data as { inStock?: unknown })?.inStock === true
      ? true
      : !trackInventory || stockQuantity > 0;

  const isSoldOut =
    (data as { isSoldOut?: unknown })?.isSoldOut === true
      ? true
      : trackInventory && stockQuantity <= 0;

  const availabilityLabel =
    typeof (data as { availabilityLabel?: unknown })?.availabilityLabel ===
    'string'
      ? (data as { availabilityLabel: string }).availabilityLabel
      : isSoldOut
        ? 'Sold out'
        : trackInventory
          ? `${stockQuantity} in stock`
          : 'Available';

  const productImages = (
    data as { images?: Array<{ image?: unknown; alt?: string }> }
  ).images;

  const productForUseProductViewed = {
    id: data.id,
    tenantSlug,
    price: data.price,
    sellerId: data.tenant.id,
    currency: 'USD'
  };

  const [, setChatState] = useState<{
    conversationId: string;
    roomId: string;
  } | null>(null);

  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useProductViewed(productForUseProductViewed);

  return (
    <div className="px-4 lg:px-12 py-10">
      <div className="border rounded-sm bg-white overflow-hidden">
        <div className="relative aspect-[3.9] border-b">
          <Image
            src={data?.cover?.url || '/placeholder.png'}
            alt={data?.name || 'Product image'}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-6">
          <div className="col-span-4">
            {/* Product name */}
            <div className="p-6">
              {/*  Add Sold out badge */}
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-medium">{data.name}</h1>
                {isSoldOut && (
                  <Badge
                    variant="destructive"
                    className="uppercase tracking-wide"
                  >
                    Sold out
                  </Badge>
                )}
              </div>
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
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
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
                <RichText data={data.description} />
              ) : (
                <p className="font-medium text-muted-foreground italic">
                  No description provided
                </p>
              )}
            </div>
            <div className="p-6 pt-0">
              {/*
                Map once; ProductGallery already filters invalid items.
              */}
              <ProductGallery
                items={useMemo(
                  () => mapProductImagesFromPayload(productImages, 'medium'),
                  [productImages]
                )}
                className="mt-2"
                thumbColsDesktop={8}
              />
            </div>
          </div>
          <div className="col-span-2">
            {/* Div around add to cart and ratings */}
            <div className="border-t lg:border-t-0 lg:border-l h-full">
              {/* Add to cart */}
              <div className="flex flex-col gap-4 p-6 border-b">
                <div className="flex flex-row items-center gap-2">
                  <ViewInOrdersButton
                    isPurchased={data.isPurchased}
                    tenantSlug={tenantSlug}
                    productId={productId}
                  />
                  {/*  Disable buy when sold out (swap CartButton for a disabled button) */}
                  {inStock ? (
                    <CartButton
                      isPurchased={data.isPurchased}
                      tenantSlug={tenantSlug}
                      productId={productId}
                    />
                  ) : (
                    <Button
                      disabled
                      aria-disabled="true"
                      title="This item is unavailable"
                      className="flex-1 cursor-not-allowed"
                    >
                      Unavailable
                    </Button>
                  )}

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
                        console.error(error);
                      }
                    }}
                    disabled={isCopied}
                  >
                    {isCopied ? <CheckCheckIcon /> : <LinkIcon />}
                  </Button>
                </div>

                <ChatButtonWithModal
                  disabled={isSelf}
                  tooltip={isSelf ? "You can't message yourself" : undefined}
                  productId={productId}
                  sellerId={data.tenant.id}
                  username={data.tenant.name}
                  onConversationCreated={(s) => setChatState(s)}
                />

                <p className="text-center font-medium">
                  {data.refundPolicy === 'no refunds'
                    ? 'No refunds'
                    : `${data.refundPolicy} money back guarantee`}
                </p>

                {/* Availability label */}
                {trackInventory && (
                  <p className="text-center text-sm font-bold text-muted-foreground">
                    {availabilityLabel}
                  </p>
                )}
              </div>

              {/* Ratings */}
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-medium">Ratings</h3>
                  <div className="flex items-center gap-x-1 font-medium">
                    <StarIcon className="size-4 fill-black" />
                    <p>({data.reviewRating})</p>
                    <p className="text-base">{data.reviewCount} ratings</p>
                  </div>
                </div>

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

export const ProductViewSkeleton = () => {
  return (
    <div className="px-4 lg:px-12 py-10">
      <div className="border rounded-sm bg-white overflow-hidden">
        <div className="relative aspect-[3.9] border-b">
          <Image
            src={'/placeholder.png'}
            alt="Placeholder"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
};
