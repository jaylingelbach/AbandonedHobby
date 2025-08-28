// import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
// import { SearchParams } from 'nuqs/server';

// import { getQueryClient, trpc } from '@/trpc/server';

// import { loadProductFilters } from '@/modules/products/search-params';
// import { ProductListView } from '@/modules/products/ui/views/product-list-view';
// import { DEFAULT_LIMIT } from '@/constants';

// interface Props {
//   params: Promise<{
//     subcategory: string;
//   }>;
//   searchParams: Promise<SearchParams>;
// }

// const Page = async ({ params, searchParams }: Props) => {
//   const { subcategory } = await params;
//   const filters = await loadProductFilters(searchParams);

//   const queryClient = getQueryClient();
//   void queryClient.prefetchInfiniteQuery(
//     trpc.products.getMany.infiniteQueryOptions({
//       ...filters,
//       category: subcategory,
//       limit: DEFAULT_LIMIT
//     })
//   );
//   return (
//     <HydrationBoundary state={dehydrate(queryClient)}>
//       <ProductListView category={subcategory} />
//     </HydrationBoundary>
//   );
// };

// export default Page;
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'nuqs/server';

import { getQueryClient, trpc } from '@/trpc/server';
import { loadProductFilters } from '@/modules/products/search-params';
import { ProductListView } from '@/modules/products/ui/views/product-list-view';
import { DEFAULT_LIMIT } from '@/constants';

interface Props {
  params: Promise<{
    category: string;
    subcategory: string;
  }>;
  searchParams: Promise<SearchParams>;
}

const Page = async ({ params, searchParams }: Props) => {
  const { category, subcategory } = await params; // 👈 get both
  const filters = await loadProductFilters(searchParams);

  const queryClient = getQueryClient();

  // 👇 prefetch with BOTH slugs
  void queryClient.prefetchInfiniteQuery(
    trpc.products.getMany.infiniteQueryOptions({
      ...filters,
      category,
      subcategory,
      limit: DEFAULT_LIMIT,
      cursor: 1
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* If ProductListView only takes `category`, update it to accept `subcategory` too */}
      <ProductListView category={category} subcategory={subcategory} />
    </HydrationBoundary>
  );
};

export default Page;
