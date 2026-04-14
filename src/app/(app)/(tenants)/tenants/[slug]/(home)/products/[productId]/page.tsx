import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';

import { ProductView } from '@/modules/products/ui/views/product-view';
import { ProductViewSkeleton } from '@/modules/products/ui/views/product-view';
import { caller, getQueryClient, trpc } from '@/trpc/server';

import type { Metadata } from 'next';
import { isMediaUrl } from '@/lib/server/moderation/utils';
import { getTenantNameSafe, getTenantSlugSafe } from '@/lib/utils';

const getProduct = cache((productId: string) =>
  caller.products.getOne({ id: productId })
);


interface Props {
  params: Promise<{ productId: string; slug: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productId, slug } = await params;

  try {
    const product = await getProduct(productId);
    if (getTenantSlugSafe(product.tenant) !== slug) return {};

    const imageField = product.images?.[0]?.image;
    const imageUrl =
      isMediaUrl(imageField) && imageField.url
        ? imageField.url
        : '/open-graph-image.png';

    const tenantName = getTenantNameSafe(product.tenant);

    const description = `Buy ${product.name} from ${tenantName} on Abandoned Hobby. Find secondhand hobby gear, craft supplies, and creative tools.`;
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.abandonedhobby.com'}/tenants/${slug}/products/${productId}`;

    return {
      title: product.name,
      description,
      openGraph: {
        type: 'website',
        url,
        images: [
          {
            url: imageUrl,
            alt: product.name
          }
        ]
      }
    };
  } catch (error) {
    console.error('Failed to generate product metadata:', error);
    return { title: 'Product on Abandoned Hobby' };
  }
}
const Page = async ({ params }: Props) => {
  const { productId, slug } = await params;
  /* ── pre-fetch tenant data on the server ─────────────────────────────── */
  const queryClient = getQueryClient();
  const product = await getProduct(productId);
  if (getTenantSlugSafe(product.tenant) !== slug) return notFound();
  queryClient.setQueryData(
    trpc.products.getOne.queryOptions({ id: productId }).queryKey,
    product
  );
  await queryClient.prefetchQuery(trpc.tenants.getOne.queryOptions({ slug }));
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
