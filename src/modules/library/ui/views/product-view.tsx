'use client';

import Link from 'next/link';
import { Suspense } from 'react';

import { ArrowLeftIcon } from 'lucide-react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import ReviewSidebar from '../components/review-sidebar';
import { ReviewFormSkeleton } from '../components/review-form';
import { RichText } from '@payloadcms/richtext-lexical/react';
import { ChatButtonWithModal } from '@/modules/conversations/ui/chat-button-with-modal';
import { useUser } from '@/hooks/use-user';
import { relDoc, relId } from '@/lib/relationshipHelpers';
import type { Product, Tenant } from '@/payload-types';

interface Props {
  productId: string;
}
export const ProductView = ({ productId }: Props) => {
  const trpc = useTRPC();
  const { user } = useUser();
  const { data: product } = useSuspenseQuery(
    trpc.library.getOne.queryOptions({ productId })
  ) as { data: Product };

  const tenantDoc = relDoc<Tenant>(product.tenant);

  const tenantId = relId<Tenant>(product.tenant);

  const sellerName = tenantDoc?.name ?? 'Seller';

  const isViewerSeller = !!user?.tenants?.some(
    (t) => relId<Tenant>(t.tenant) === tenantId
  );

  const trackingProvided = false;
  const trackingNumber = '69420';

  return (
    <div className="min-h-screen bg-white">
      <nav className="p-4 bg-[#F4F4F0] w-full border-b">
        <Link prefetch href="/orders" className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium ">Back to Orders </span>
        </Link>
      </nav>
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[40px] font-medium">{product.name} </h1>
        </div>
      </header>
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-16 ">
          {/* two columns */}
          <div className="lg:col-span-2">
            <div className="p-4 bg-white rounded-md border gap-4">
              <Suspense fallback={<ReviewFormSkeleton />}>
                <ReviewSidebar productId={productId} />
              </Suspense>
            </div>
          </div>
          <div className="lg:col-span-5">
            {product.content ? (
              <RichText data={product.content} />
            ) : (
              <p className="font-medium italic text-muted-foreground">
                No special content
              </p>
            )}
          </div>
        </div>
        <div>
          Placeholder for starting returns, messaging seller, tracking etc.
          <div className="mt-2 mb-2">
            {!isViewerSeller && tenantId && (
              <ChatButtonWithModal
                productId={productId}
                sellerId={tenantId} // pass Tenant id; backend resolves to seller User
                username={sellerName}
              />
            )}
          </div>
          <div className="mt-2 mb-2">
            {/* Small card?  */}
            {!trackingProvided ? 'Awaiting shipment' : `${trackingNumber}`}
            {/* order date */}
            {/* order total */}
            {/* order number */}
            {/* Returns accepted through - (seller or item return policy from product) */}
          </div>
          <div className="mt-2 mb-2">returns</div>
        </div>
      </section>
    </div>
  );
};

export const ProductViewSkeleton = () => {
  return (
    <div className="min-h-screen bg-white">
      <nav className="p-4 bg-[#F4F4F0] w-full border-b">
        <div className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium ">Back to Orders </span>
        </div>
      </nav>
    </div>
  );
};
