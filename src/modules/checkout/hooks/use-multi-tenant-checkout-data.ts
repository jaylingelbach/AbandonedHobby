'use client';

import { useTRPC } from '@/trpc/client';
import { MultiTenantCheckoutData, TenantCheckoutGroup } from './types';
import { useAllTenantCarts } from './use-cart';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Product } from '@/payload-types';
import {
  CartItemForShipping,
  SidebarShippingLine
} from '@/modules/orders/types';
import { toProductWithShipping } from '../utils/to-product-with-shipping';
import { calculateShippingAmount } from '../utils/calculate-shipping-amount';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { getTenantNameSafe, getTenantSlugSafe } from '@/lib/utils';

/**
 * Load all cart items for the current user across all tenants,
 * fetch their product data, and group them by tenant with
 * per-tenant totals and shipping breakdowns.
 */
export function useMultiTenantCheckoutData(): {
  data: MultiTenantCheckoutData | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
} {
  const trpc = useTRPC();
  const tenantCarts = useAllTenantCarts();

  // Flatten all product ids across all tenant carts
  const allProductIds = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          tenantCarts.flatMap((cart) => cart.productIds.map((id) => String(id)))
        )
      ),
    [tenantCarts]
  );

  // If there is nothing in any cart, we can bail early
  const hasAnyItems = allProductIds.length > 0;

  const productsQueryOptions = useMemo(
    () => trpc.checkout.getProducts.queryOptions({ ids: allProductIds }),
    [trpc.checkout.getProducts, allProductIds]
  );

  const {
    data: productsPayload,
    error,
    isLoading,
    isFetching,
    isError,
    refetch
  } = useQuery({
    ...productsQueryOptions,
    enabled: hasAnyItems,
    placeholderData: (previous) => previous,
    retry: 1
  });

  // Stable array of product docs
  const docs = useMemo<Product[]>(
    () =>
      hasAnyItems && Array.isArray(productsPayload?.docs)
        ? (productsPayload.docs as Product[])
        : [],
    [hasAnyItems, productsPayload]
  );

  // Lookup map: productId -> Product
  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of docs) {
      map.set(String(product.id), product);
    }
    return map;
  }, [docs]);

  const groups = useMemo<TenantCheckoutGroup[]>(() => {
    if (!hasAnyItems || docs.length === 0) return [];

    const result: TenantCheckoutGroup[] = [];

    for (const tenantCart of tenantCarts) {
      const { tenantKey, productIds, quantitiesByProductId } = tenantCart;

      // Resolve products for this tenant
      const productsForTenant: Product[] = [];
      for (const rawId of productIds) {
        const id = String(rawId);
        const product = productsById.get(id);
        if (product) {
          productsForTenant.push(product);
        }
      }

      if (productsForTenant.length === 0) {
        continue;
      }

      // Build shipping lines for this tenant’s products
      const itemizedLines: SidebarShippingLine[] = productsForTenant
        .map((product) => {
          const normalized = toProductWithShipping(product);
          const shippingMode = normalized?.shippingMode ?? 'free';
          const amountCents = normalized
            ? calculateShippingAmount(normalized)
            : 0;

          return {
            id: String(product.id),
            label: typeof product.name === 'string' ? product.name : 'Item',
            amountCents,
            mode: shippingMode
          };
        })
        // We hide "free" shipping in the breakdown (matches existing behavior)
        .filter((line) => line.mode !== 'free');

      const hasCalculatedShipping = itemizedLines.some(
        (line) => line.mode === 'calculated'
      );

      // Turn those lines into CartItemForShipping[] with quantities
      const breakdownItems: CartItemForShipping[] = itemizedLines.map(
        (line) => ({
          id: line.id,
          name: line.label,
          quantity: readQuantityOrDefault(quantitiesByProductId[line.id] ?? 1),
          shippingMode: line.mode,
          shippingFeeCentsPerUnit:
            line.mode === 'flat' ? line.amountCents : undefined
        })
      );

      // Subtotal (cents) for this tenant, quantity-aware
      const subtotalCents = productsForTenant.reduce((sum, product) => {
        const id = String(product.id);
        const rawQuantity = quantitiesByProductId[id];
        const quantity = readQuantityOrDefault(rawQuantity);

        let priceDollars = 0;
        if (
          typeof product.price === 'number' &&
          Number.isFinite(product.price)
        ) {
          priceDollars = product.price;
        } else if (typeof product.price === 'string') {
          const parsed = Number(product.price);
          priceDollars = Number.isFinite(parsed) ? parsed : 0;
        }

        const priceCents = Math.round(priceDollars * 100);
        return sum + priceCents * quantity;
      }, 0);

      // Shipping (cents), counting only flat-fee items (calculated happens in Stripe)
      const shippingCents = breakdownItems.reduce((sum, item) => {
        if (item.shippingMode !== 'flat') return sum;
        const perUnit = item.shippingFeeCentsPerUnit ?? 0;
        return sum + perUnit * item.quantity;
      }, 0);

      const totalCents = subtotalCents + shippingCents;

      const firstProduct = productsForTenant[0];
      const tenantRel = firstProduct?.tenant;
      const tenantSlug =
        getTenantSlugSafe(tenantRel) ??
        (tenantKey && tenantKey !== '__global__' ? tenantKey : null);
      const tenantName = getTenantNameSafe(tenantRel) ?? tenantSlug ?? 'Shop';

      result.push({
        tenantKey,
        tenantSlug,
        tenantName,
        products: productsForTenant,
        quantitiesByProductId,
        subtotalCents,
        shippingCents,
        totalCents,
        breakdownItems,
        hasCalculatedShipping
      });
    }

    return result;
  }, [docs.length, hasAnyItems, tenantCarts, productsById]);

  const grandSubtotalCents = useMemo(
    () => groups.reduce((sum, group) => sum + group.subtotalCents, 0),
    [groups]
  );

  const grandShippingCents = useMemo(
    () => groups.reduce((sum, group) => sum + group.shippingCents, 0),
    [groups]
  );

  const grandTotalCents = useMemo(
    () => grandSubtotalCents + grandShippingCents,
    [grandSubtotalCents, grandShippingCents]
  );

  const data: MultiTenantCheckoutData | null = hasAnyItems
    ? {
        groups,
        grandSubtotalCents,
        grandShippingCents,
        grandTotalCents
      }
    : null;

  return {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  };
}
