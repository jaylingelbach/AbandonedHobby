import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';

import { ProductView } from '@/modules/products/ui/views/product-view';
import { ProductViewSkeleton } from '@/modules/products/ui/views/product-view';
import { getQueryClient, trpc } from '@/trpc/server';

import type { Metadata } from 'next';
import { getPayloadClient } from '@/lib/payload';
import { isMediaUrl } from '@/lib/server/moderation/utils';

interface Props {
  params: Promise<{ productId: string; slug: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId, slug } = await params;

  try {
    const payload = await getPayloadClient();
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 1
    });

    const imageField = product.images?.[0]?.image;
    const imageUrl =
      isMediaUrl(imageField) && imageField.url
        ? imageField.url
        : '/open-graph-image.png';

    const tenantName =
      typeof product.tenant === 'object' &&
      product.tenant !== null &&
      'name' in product.tenant
        ? product.tenant.name
        : slug;

    const description = `Buy ${product.name} from ${tenantName} on Abandoned Hobby. Find secondhand hobby gear, craft supplies, and creative tools.`;
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.abandonedhobby.com'}/tenants/${slug}/products/${productId}`;

    return {
      title: product.name,
      description,
      openGraph: {
        type: 'website',
        url,
        images: [imageUrl]
      }
    };
  } catch {
    return { title: 'Product on Abandoned Hobby' };
  }
}
const Page = async ({ params }: Props) => {
  const { productId, slug } = await params;

  /* ── pre-fetch tenant data on the server ─────────────────────────────── */
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.tenants.getOne.queryOptions({ slug })),
    queryClient.prefetchQuery(
      trpc.products.getOne.queryOptions({ id: productId })
    )
  ]);
  return (
    <div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ProductViewSkeleton />}>
          <ProductView productId={productId} tenantSlug={slug} />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
};

export default Page;
