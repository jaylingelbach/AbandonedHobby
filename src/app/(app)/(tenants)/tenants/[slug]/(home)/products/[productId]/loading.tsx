import { ProductViewSkeleton } from '@/modules/products/ui/views/product-view';

/**
 * Renders the loading UI for the product detail route.
 *
 * @returns A React element that displays the product view skeleton.
 */
export default function Loading() {
  return <ProductViewSkeleton />;
}
