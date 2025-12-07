'use client';

import { useEffect } from 'react';
import { useServerCart } from '@/modules/cart/hooks/use-server-cart';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

import type { CartItem } from '@/modules/cart/server/types';
import {
  adjustItemsByProductId,
  setQuantityForProduct,
  removeProduct
} from './line-helpers';

function runCartHelperTests() {
  // Small helper to build a CartItem quickly
  const makeItem = (productId: string, quantity: number): CartItem => ({
    product: productId,
    nameSnapshot: `Product ${productId}`,
    unitAmountCents: 1000,
    quantity,
    addedAt: new Date().toISOString(),
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });

  // ── Test 1: adjustItemsByProductId (delta logic) ────────────────────────────
  const startA: CartItem[] = [makeItem('p1', 1), makeItem('p2', 2)];

  console.log('--- adjustItemsByProductId tests ---');
  console.log('startA:', structuredClone(startA));

  // 1a) Increase quantity of existing product (p1, +2) → quantity should be 3
  const afterA1 = adjustItemsByProductId(startA, 'p1', 2, {
    nameSnapshot: 'Product p1',
    unitAmountCentsSnapshot: 1000,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterA1 (p1 +2):', afterA1);

  // 1b) Decrease quantity of same product (p1, -1) → from 3 down to 2
  const afterA2 = adjustItemsByProductId(afterA1, 'p1', -1, {
    nameSnapshot: 'Product p1',
    unitAmountCentsSnapshot: 1000,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterA2 (p1 -1):', afterA2);

  // 1c) Big negative delta that removes the line (p1, -10) → p1 should disappear
  const afterA3 = adjustItemsByProductId(afterA2, 'p1', -10, {
    nameSnapshot: 'Product p1',
    unitAmountCentsSnapshot: 1000,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterA3 (p1 -10, expect removed):', afterA3);

  // 1d) Positive delta for product that doesn't exist yet (p3, +1) → new line added
  const afterA4 = adjustItemsByProductId(afterA3, 'p3', 1, {
    nameSnapshot: 'Product p3',
    unitAmountCentsSnapshot: 2500,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterA4 (p3 +1, expect new line):', afterA4);

  // ── Test 2: setQuantityForProduct (absolute quantity) ──────────────────────
  const startB: CartItem[] = [makeItem('p1', 1)];

  console.log('--- setQuantityForProduct tests ---');
  console.log('startB:', structuredClone(startB));

  // 2a) Set p1 quantity to 5
  const afterB1 = setQuantityForProduct(startB, 'p1', 5, {
    nameSnapshot: 'Product p1',
    unitAmountCentsSnapshot: 1000,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterB1 (p1 -> 5):', afterB1);

  // 2b) Set p1 quantity to 0 → remove the line
  const afterB2 = setQuantityForProduct(afterB1, 'p1', 0, {
    nameSnapshot: 'Product p1',
    unitAmountCentsSnapshot: 1000,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterB2 (p1 -> 0, expect removed):', afterB2);

  // 2c) Set quantity for product that doesn't exist yet (p2 -> 3) → new line
  const afterB3 = setQuantityForProduct(afterB2, 'p2', 3, {
    nameSnapshot: 'Product p2',
    unitAmountCentsSnapshot: 1500,
    imageSnapshot: null,
    shippingModeSnapshot: 'flat'
  });
  console.log('afterB3 (p2 -> 3, expect new line):', afterB3);

  // ── Test 3: removeProduct ───────────────────────────────────────────────────
  const startC: CartItem[] = [
    makeItem('p1', 1),
    makeItem('p2', 2),
    makeItem('p3', 3)
  ];

  console.log('--- removeProduct tests ---');
  console.log('startC:', structuredClone(startC));

  // 3a) Remove existing product p2
  const afterC1 = removeProduct(startC, 'p2');
  console.log('afterC1 (remove p2, expect p1+p3):', afterC1);

  // 3b) Remove non-existing product p4 → array should be unchanged
  const afterC2 = removeProduct(afterC1, 'p4');
  console.log('afterC2 (remove p4, expect unchanged):', afterC2);

  // Extra: sanity check original arrays weren’t mutated
  console.log('startA (should be unchanged):', startA);
  console.log('startB (should be unchanged):', startB);
  console.log('startC (should be unchanged):', startC);
}

const Page = () => {
  const trpc = useTRPC();
  const mockTenantSlug = { tenantSlug: 'support' };
  const { data } = useQuery(trpc.cart.getActive.queryOptions(mockTenantSlug));
  console.log(`data: ${JSON.stringify(data, null, 2)}`);

  const { cart, isLoading, isError, error } = useServerCart('support');

  useEffect(() => {
    runCartHelperTests();
  }, []);

  if (isLoading) return <div>...loading</div>;
  if (isError) return <div>Error: {error?.message}</div>;

  console.log(`cart: ${JSON.stringify(cart, null, 2)}`);

  return <div>Test for trpc.getActive + cart helpers</div>;
};

export default Page;
