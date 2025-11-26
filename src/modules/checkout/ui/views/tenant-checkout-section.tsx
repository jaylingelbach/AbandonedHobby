'use client';

import Link from 'next/link';
import { InboxIcon } from 'lucide-react';

import {
  generateTenantURL,
  getPrimaryCardImageUrl,
  getTenantNameSafe,
  getTenantSlugSafe
} from '@/lib/utils';
import { readQuantityOrDefault } from '@/lib/validation/quantity';

import { useCart } from '../../hooks/use-cart';
import CheckoutSidebar from '../components/checkout-sidebar';
import { CheckoutItem } from '../components/checkout-item';
import { TenantCheckoutGroup } from '../../hooks/use-multi-tenant-checkout-data';

export interface TenantCheckoutSectionProps {
  group: TenantCheckoutGroup;
  /** Global busy flag from parent (disables buttons while a checkout is in progress) */
  isBusy: boolean;
  /** Called when user clicks "Checkout for this shop" */
  onCheckoutAction: (group: TenantCheckoutGroup) => void;
}

/**
 * Per-tenant checkout section, similar to Etsy's "Check out for this shop only".
 *
 * Renders:
 *  - The seller header (name + link)
 *  - Their products in the cart
 *  - A sidebar summary with a "Checkout for this shop" button
 *
 * No Stripe calls happen in here; those are handled by the parent view.
 */
export function TenantCheckoutSection({
  group,
  isBusy,
  onCheckoutAction
}: TenantCheckoutSectionProps) {
  const {
    tenantKey,
    tenantSlug,
    tenantName,
    products,
    quantitiesByProductId,
    subtotalCents,
    shippingCents,
    totalCents,
    breakdownItems,
    hasCalculatedShipping
  } = group;

  const { addProduct, removeProduct } = useCart(tenantSlug ?? tenantKey);

  if (products.length === 0) {
    return (
      <section className="border border-dashed border-black rounded-md bg-white p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <InboxIcon className="size-4" />
          <span>{tenantName} has no items in your cart.</span>
        </div>
      </section>
    );
  }

  const safeTenantSlug =
    tenantSlug ??
    getTenantSlugSafe(products[0]?.tenant) ??
    (tenantKey !== '__global__' ? tenantKey : null);

  const tenantHref = safeTenantSlug
    ? generateTenantURL(safeTenantSlug)
    : undefined;

  return (
    <section className="border rounded-md bg-white p-4 lg:p-6 flex flex-col gap-4">
      {/* Header: seller name + optional link */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold leading-tight">
            {tenantHref ? (
              <Link
                href={tenantHref}
                className="underline-offset-2 hover:underline"
              >
                {tenantName}
              </Link>
            ) : (
              tenantName
            )}
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-6">
        {/* Items list */}
        <div className="lg:col-span-4">
          <div className="border rounded-md overflow-hidden bg-white">
            {products.map((product, index) => {
              const productIdStr = String(product.id);

              const imageURL =
                (product as { cardImageUrl?: string | null }).cardImageUrl ??
                getPrimaryCardImageUrl(product);

              const productTenantSlug =
                getTenantSlugSafe(product.tenant) ?? safeTenantSlug;

              const productTenantName =
                getTenantNameSafe(product.tenant) ?? tenantName;

              const productURL = productTenantSlug
                ? `${generateTenantURL(productTenantSlug)}/products/${product.id}`
                : `/products/${product.id}`;

              const tenantURL = productTenantSlug
                ? generateTenantURL(productTenantSlug)
                : '#';

              const quantity = quantitiesByProductId[productIdStr] ?? 1;

              return (
                <CheckoutItem
                  key={product.id}
                  isLast={index === products.length - 1}
                  imageURL={imageURL ?? undefined}
                  name={product.name}
                  productURL={productURL}
                  tenantURL={tenantURL}
                  tenantName={productTenantName}
                  price={product.price}
                  quantity={quantity}
                  onQuantityChange={(next) => {
                    const safeQuantity = readQuantityOrDefault(next);
                    addProduct(productIdStr, safeQuantity);
                  }}
                  onRemove={() => removeProduct(productIdStr)}
                />
              );
            })}
          </div>
        </div>

        {/* Per-tenant summary + button */}
        <div className="lg:col-span-3">
          <CheckoutSidebar
            subtotalCents={subtotalCents}
            shippingCents={shippingCents}
            totalCents={totalCents}
            onPurchaseAction={() => onCheckoutAction(group)}
            isCanceled={false}
            disabled={isBusy}
            hasCalculatedShipping={hasCalculatedShipping}
            breakdownItems={breakdownItems}
          />
        </div>
      </div>
    </section>
  );
}

export default TenantCheckoutSection;
