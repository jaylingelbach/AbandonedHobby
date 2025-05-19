'use client';
import { toast } from 'sonner';
import { useEffect } from 'react';

import { InboxIcon, LoaderIcon } from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { generateTenantURL } from '@/lib/utils';

import { CheckoutItem } from '../components/checkout-item';
import { useCart } from '../../hooks/use-cart';
import CheckoutSidebar from '../components/checkout-sidebar';

interface CheckoutViewProps {
  tenantSlug: string;
}

export const CheckoutView = ({ tenantSlug }: CheckoutViewProps) => {
  const { productIds, removeProduct, clearAllCarts } = useCart(tenantSlug);
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    // useQuery bc no prefetching no hydration no suspense. All localstorage.
    trpc.checkout.getProducts.queryOptions({ ids: productIds })
  );

  //  instead of clearing all carts maybe clear the specific product from the cart?
  useEffect(() => {
    if (error?.data?.code === 'NOT_FOUND') {
      clearAllCarts();
      toast.warning('Invalid products found, your cart has been cleared');
    }
  }, [error, clearAllCarts]);

  if (isLoading) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-4 bg-white w-full rounded-lg">
          <LoaderIcon className="text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }
  if (data?.totalDocs === 0) {
    return (
      <div className="lg:pt-12 pt-4 px-4 lg:px-12">
        <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-y-4 bg-white rounded-lg">
          <InboxIcon />
          <p className="text-base font-medium">No products found </p>
        </div>
      </div>
    );
  }
  return (
    <div className="lg:pt-12 pt-4 px-4 lg:px-12">
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-16">
        {/* render items in first column */}
        <div className="lg:col-span-4 ">
          <div className="border rounded-md overflow-hidden bg-white">
            {data?.docs.map((product, index) => (
              <CheckoutItem
                key={product.id}
                isLast={index === data.docs.length - 1}
                imageURL={product.image?.url}
                name={product.name}
                productURL={`${generateTenantURL(product.tenant.slug)}/products/${product.id}`}
                tenantURL={`${generateTenantURL(product.tenant.slug)} `}
                tenantName={product.tenant.name}
                price={product.price}
                onRemove={() => removeProduct(product.id)}
              />
            ))}
          </div>
        </div>
        {/* Checkout sidebar */}
        <div className="lg:col-span-3">
          <CheckoutSidebar
            total={data?.totalPrice || 0}
            onCheckout={() => {}}
            isCanceled={false}
            isPending={false}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutView;
