'use client';

import { RichText } from '@payloadcms/richtext-lexical/react';
import {
  useQueryClient,
  useSuspenseQuery,
  useQuery
} from '@tanstack/react-query';
import { ArrowLeftIcon, Truck, RefreshCw } from 'lucide-react';
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
import type { OrderForBuyer } from '../components/types';
import { useTRPC } from '@/trpc/client';

import InvoiceDialog from '../components/invoice-dialog';
import { ReviewFormSkeleton } from '../components/review-form';
import ReviewSidebar from '../components/review-sidebar';

import { buildTrackingUrl, isLexicalRichTextEmpty } from '@/lib/utils';

import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

/**
 * Determines whether a value is a Lexical `SerializedEditorState` whose `root` node exists.
 *
 * @returns `true` if `value` is a `SerializedEditorState` whose `root` has `type === 'root'` and a `children` array, `false` otherwise.
 */

function isLexicalEditorState(
  value: unknown
): value is SerializedEditorState<SerializedLexicalNode> {
  if (value === null || typeof value !== 'object') return false;
  const root = (value as { root?: unknown }).root;
  if (root === null || typeof root !== 'object') return false;
  const type = (root as { type?: unknown }).type;
  const children = (root as { children?: unknown }).children;
  return type === 'root' && Array.isArray(children);
}

interface Props {
  productId: string;
  orderId: string;
}

const neoBrut =
  'rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

export const ProductView = ({ productId, orderId }: Props) => {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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
  const sellerEmail = tenantDoc?.notificationEmail;

  const isViewerSeller =
    mounted &&
    !!user?.tenants?.some(
      (tenant) => relId<Tenant>(tenant.tenant) === tenantId
    );
  const success = search.get('success') === 'true';

  // Summary for sidebar (fast)
  const orderSummaryQuery = useMemo(
    () => trpc.orders.getForBuyerById.queryOptions({ orderId }),
    [trpc, orderId]
  );
  const { data: order } = useSuspenseQuery(orderSummaryQuery);

  // Full order (for invoice) — fetched **on demand**
  const fullOrderQuery = useMemo(
    () => trpc.orders.getForBuyerFull.queryOptions({ orderId }),
    [trpc, orderId]
  );
  const {
    data: fullOrder,
    refetch: refetchFullOrder,
    isFetching: isFetchingFullOrder
  } = useQuery({
    ...fullOrderQuery,
    enabled: false,
    refetchOnWindowFocus: false
  });

  const orderForInvoiceFallback: OrderForBuyer | null = useMemo(() => {
    if (!order) return null;
    return {
      id: order.orderId,
      orderNumber: order.orderNumber,
      orderDateISO: order.orderDateISO,
      totalCents: order.totalCents,
      currency: order.currency,
      quantity: order.quantity,
      items: undefined,
      buyerEmail: null,
      shipping: order.shipping ?? null,
      returnsAcceptedThroughISO: order.returnsAcceptedThroughISO ?? null
    };
  }, [order]);

  const openInvoice = () => {
    setInvoiceOpen(true);
    void refetchFullOrder();
  };

  useEffect(() => {
    if (!success) return;
    void queryClient.invalidateQueries({
      queryKey: orderSummaryQuery.queryKey
    });
    const url = new URL(window.location.href);
    url.searchParams.delete('success');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [success, orderSummaryQuery.queryKey, queryClient, router]);

  const contentUnknown = product.content as unknown;

  const content: SerializedEditorState<SerializedLexicalNode> | null =
    isLexicalEditorState(contentUnknown) ? contentUnknown : null;

  const hasSpecialContent =
    content !== null ? !isLexicalRichTextEmpty(content) : false;

  const trackingNumber = order?.shipment?.trackingNumber ?? null;
  const trackingProvided = Boolean(trackingNumber);
  const carrier = order?.shipment?.carrier;
  const trackingUrl =
    trackingProvided && carrier && trackingNumber
      ? buildTrackingUrl(carrier, trackingNumber)
      : null;

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
        <div className="flex flex-col gap-6">
          {/* 1) Order summary (top priority) */}
          {order ? (
            <OrderSummaryCard
              orderDate={order.orderDateISO}
              totalCents={order.totalCents}
              orderNumber={order.orderNumber}
              returnsAcceptedThrough={order.returnsAcceptedThroughISO}
              quantity={order.quantity}
              shipping={order.shipping}
              onViewInvoice={openInvoice}
              canViewInvoice={true}
              isInvoiceLoading={isFetchingFullOrder}
            />
          ) : (
            <div className="text-sm italic text-muted-foreground">
              No order found for this item.
            </div>
          )}

          {/* 2) Shipment & Actions */}
          <Card className={neoBrut}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Shipment & Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="size-4" />
                  <span className="font-medium">Status</span>
                </div>
                {trackingProvided ? (
                  <Badge className="border-2 border-black" variant="secondary">
                    {trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Tracking #{trackingNumber}
                      </a>
                    ) : (
                      <>Tracking #{trackingNumber}</>
                    )}
                  </Badge>
                ) : (
                  <Badge className="border-2 border-black">
                    Awaiting shipment
                  </Badge>
                )}
              </div>

              <Separator />

              <div className="grid gap-2">
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

                {order && (
                  <InvoiceDialog
                    open={invoiceOpen}
                    onOpenChange={setInvoiceOpen}
                    order={
                      (fullOrder as OrderForBuyer | null) ??
                      orderForInvoiceFallback
                    }
                    productNameFallback={product.name}
                    sellerName={sellerName}
                    sellerEmail={sellerEmail ?? 'Seller'}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3) Item details (only if meaningful content) */}
          {hasSpecialContent && (
            <Card className={neoBrut}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Item details</CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none">
                {content && <RichText data={content} />}
              </CardContent>
            </Card>
          )}

          {/* 4) Reviews */}
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
      </section>
    </div>
  );
};

export const ProductViewSkeleton = () => (
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
