'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo } from 'react';
import { ArrowLeftIcon, Truck, RefreshCw, Receipt } from 'lucide-react';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import ReviewSidebar from '../components/review-sidebar';
import { ReviewFormSkeleton } from '../components/review-form';
import { RichText } from '@payloadcms/richtext-lexical/react';
import { ChatButtonWithModal } from '@/modules/conversations/ui/chat-button-with-modal';
import { useUser } from '@/hooks/use-user';
import { relDoc, relId } from '@/lib/relationshipHelpers';
import type { Product, Tenant } from '@/payload-types';

import { OrderSummaryCard } from '@/modules/orders/ui/OrderSummaryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'next/navigation';

interface Props {
  productId: string;
}

const neoBrut =
  'rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

export const ProductView = ({ productId }: Props) => {
  const trpc = useTRPC();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const search = useSearchParams();

  const { data: product } = useSuspenseQuery(
    trpc.library.getOne.queryOptions({ productId })
  ) as { data: Product };

  const tenantDoc = relDoc<Tenant>(product.tenant);
  const tenantId = relId<Tenant>(product.tenant);
  const sellerName = tenantDoc?.name ?? 'Seller';

  const isViewerSeller = !!user?.tenants?.some(
    (t) => relId<Tenant>(t.tenant) === tenantId
  );

  // Mocked shipment + order data for now
  const trackingProvided = false;
  const trackingNumber = '69420';

  const success = search.get('success') === 'true';

  const orderOpts = useMemo(
    () => trpc.orders.getLatestForProduct.queryOptions({ productId }),
    [trpc, productId]
  );

  const { data: order } = useSuspenseQuery(orderOpts);

  useEffect(() => {
    if (!success) return;
    void queryClient.invalidateQueries({ queryKey: orderOpts.queryKey });
  }, [success, orderOpts.queryKey, queryClient]);

  return (
    <div className="min-h-screen bg-[#F4F4F0]">
      {/* Top nav */}
      <nav className="p-4 w-full border-b bg-[#F4F4F0]">
        <Link prefetch href="/orders" className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium">Back to Orders</span>
        </Link>
      </nav>

      {/* Header */}
      <header className="py-8 border-b bg-[#F4F4F0]">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[40px] font-medium leading-none">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sold by <span className="font-medium">{sellerName}</span>
          </p>
        </div>
      </header>

      {/* Main */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Main content */}
          <div className="lg:col-span-8">
            <Card className={`${neoBrut}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Item details</CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none">
                {product.content ? (
                  <RichText data={product.content} />
                ) : (
                  <p className="font-medium italic text-muted-foreground">
                    No special content
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right rail (sticky) */}
          <div className="lg:col-span-4">
            <div className="sticky top-4 space-y-6">
              {order ? (
                <OrderSummaryCard
                  orderDate={order.orderDateISO}
                  totalCents={order.totalCents}
                  orderNumber={order.orderNumber}
                  returnsAcceptedThrough={order.returnsAcceptedThroughISO}
                  quantity={order.quantity}
                />
              ) : (
                <div className="text-sm italic text-muted-foreground">
                  No order found for this item.
                </div>
              )}
              {/* Shipment & actions */}
              <Card className={`${neoBrut}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Shipment & actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="size-4" />
                      <span className="font-medium">Status</span>
                    </div>
                    {trackingProvided ? (
                      <Badge
                        className="border-2 border-black"
                        variant="secondary"
                      >
                        Tracking #{trackingNumber}
                      </Badge>
                    ) : (
                      <Badge className="border-2 border-black">
                        Awaiting shipment
                      </Badge>
                    )}
                  </div>

                  <Separator />

                  {/* Actions (mocked / placeholders) */}
                  <div className="grid gap-2">
                    {!isViewerSeller && tenantId && (
                      <div className="w-full">
                        {/* Chat button component controls its own UI; grouped here for layout */}
                        <ChatButtonWithModal
                          productId={productId}
                          sellerId={tenantId}
                          username={sellerName}
                        />
                      </div>
                    )}

                    <Button
                      className="justify-start border-2 border-black mt-1"
                      variant="secondary"
                      disabled
                    >
                      <RefreshCw className="mr-2 size-4" />
                      Start a return (coming soon)
                    </Button>

                    <Button
                      className="justify-start border-2 border-black"
                      variant="secondary"
                      disabled
                    >
                      <Receipt className="mr-2 size-4" />
                      View invoice (coming soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reviews */}
              <Card className={`${neoBrut}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<ReviewFormSkeleton />}>
                    <ReviewSidebar productId={productId} />
                  </Suspense>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const ProductViewSkeleton = () => {
  return (
    <div className="min-h-screen bg-[#F4F4F0]">
      <nav className="p-4 w-full border-b bg-[#F4F4F0]">
        <div className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium">Back to Orders</span>
        </div>
      </nav>
      <header className="py-8 border-b bg-[#F4F4F0]" />
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10" />
    </div>
  );
};
