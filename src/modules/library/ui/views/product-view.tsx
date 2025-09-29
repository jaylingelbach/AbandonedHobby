'use client';

import { RichText } from '@payloadcms/richtext-lexical/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, Truck, RefreshCw, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useUser } from '@/hooks/use-user';
import { relDoc, relId } from '@/lib/relationshipHelpers';
import { ChatButtonWithModal } from '@/modules/conversations/ui/chat-button-with-modal';
import { OrderSummaryCard } from '@/modules/orders/ui/OrderSummaryCard';
import type { Product, Tenant } from '@/payload-types';
import { useTRPC } from '@/trpc/client';

import InvoiceDialog from '../components/invoice-dialog';
import { ReviewFormSkeleton } from '../components/review-form';
import ReviewSidebar from '../components/review-sidebar';

interface Props {
  productId: string;
  orderId: string;
}

const neoBrut =
  'rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

export const ProductView = ({ productId, orderId }: Props) => {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // <-- hydration-safe guard
  useEffect(() => setMounted(true), []);

  const trpc = useTRPC();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const search = useSearchParams();
  const router = useRouter();

  // Product content
  const { data: product } = useSuspenseQuery(
    trpc.library.getOne.queryOptions({ productId })
  ) as { data: Product };

  const tenantDoc = relDoc<Tenant>(product.tenant);
  const tenantId = relId<Tenant>(product.tenant);
  const sellerName = tenantDoc?.name ?? 'Seller';

  // Computed but only used after mount to avoid SSR/CSR divergence
  const isViewerSeller =
    mounted &&
    !!user?.tenants?.some(
      (tenant) => relId<Tenant>(tenant.tenant) === tenantId
    );
  const trackingProvided = false;
  const trackingNumber = '69420';

  const success = search.get('success') === 'true';

  const orderQueryOptions = useMemo(
    () => trpc.orders.getForBuyerById.queryOptions({ orderId }),
    [trpc, orderId]
  );
  const { data: order } = useSuspenseQuery(orderQueryOptions);

  useEffect(() => {
    if (!success) return;
    void queryClient.invalidateQueries({
      queryKey: orderQueryOptions.queryKey
    });
    const url = new URL(window.location.href);
    url.searchParams.delete('success');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [success, orderQueryOptions.queryKey, queryClient, router]);

  return (
    <div className="min-h-screen bg-[#F4F4F0]">
      <nav className="p-4 w-full border-b bg-[#F4F4F0]">
        <Link prefetch href="/orders" className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text font-medium">Back to Orders</span>
        </Link>
      </nav>

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

      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-8">
            <Card className={neoBrut}>
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

          <div className="lg:col-span-4">
            <div className="sticky top-4 space-y-6">
              {order ? (
                <OrderSummaryCard
                  orderDate={order.orderDateISO}
                  totalCents={order.totalCents}
                  orderNumber={order.orderNumber}
                  returnsAcceptedThrough={order.returnsAcceptedThroughISO}
                  quantity={order.quantity}
                  shipping={order.shipping}
                />
              ) : (
                <div className="text-sm italic text-muted-foreground">
                  No order found for this item.
                </div>
              )}

              <Card className={neoBrut}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Shipment & actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="grid gap-2">
                    {/* Render this only after mount to keep SSR/CSR markup identical */}
                    {mounted && !isViewerSeller && tenantId && (
                      <div className="w-full">
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
                      onClick={() => setInvoiceOpen(true)}
                      disabled={!order}
                    >
                      <Receipt className="mr-2 size-4" />
                      View invoice
                    </Button>
                    {order && (
                      <InvoiceDialog
                        open={invoiceOpen}
                        onOpenChange={setInvoiceOpen}
                        order={order ?? null}
                        productNameFallback={product.name}
                        sellerName={sellerName}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={neoBrut}>
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
