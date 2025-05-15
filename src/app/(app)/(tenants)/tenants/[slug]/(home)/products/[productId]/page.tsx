import ClientProviders from '@/app/(app)/(home)/clientProviders';
import { ProductView } from '@/modules/products/ui/components/views/product-view';
import { getQueryClient, trpc } from '@/trpc/server';
import { dehydrate } from '@tanstack/react-query';

interface Props {
  params: Promise<{ productId: string; slug: string }>;
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
  const dehydratedState = dehydrate(queryClient);
  return (
    <div>
      <ClientProviders dehydratedState={dehydratedState}>
        <ProductView productId={productId} tenantSlug={slug} />
      </ClientProviders>
    </div>
  );
};

export default Page;
