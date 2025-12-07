import type { Media } from '@/payload-types';

import { CartItem } from '@/modules/cart/server/types';
export type ShippingMode = 'free' | 'flat' | 'calculated';

export type IdRef = string | { id: string } | null | undefined;

export function softRelId(ref: IdRef): string | null {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string') {
    return ref.id;
  }
  return null;
}

export type CartItemSnapshots = {
  nameSnapshot: string;
  unitAmountCentsSnapshot: number;
  imageSnapshot?: Media | string | null;
  shippingModeSnapshot?: ShippingMode | null;
};

export function adjustItemsByProductId(
  items: CartItem[],
  productId: string,
  deltaQuantity: number,
  snapshots: CartItemSnapshots
): CartItem[] {
  if (deltaQuantity === 0) return items;
  // find index
  const index = items.findIndex(
    (line) => softRelId(line.product) === productId
  );
  if (index !== -1) {
    const existing = items[index];
    // findIndex returns -1 if false so to satisfy TS check
    if (existing) {
      const newQuantity = existing.quantity + deltaQuantity;
      // remove line if less than 0
      if (newQuantity <= 0) {
        return [...items.slice(0, index), ...items.slice(index + 1)];
      }
      const updated: CartItem = {
        ...existing,
        quantity: newQuantity
      };
      return [...items.slice(0, index), updated, ...items.slice(index + 1)];
    }
  }
  // didn't find the line
  if (deltaQuantity <= 0) {
    return items;
  }

  const {
    nameSnapshot,
    unitAmountCentsSnapshot,
    imageSnapshot,
    shippingModeSnapshot
  } = snapshots;

  const newLine: CartItem = {
    product: productId,
    nameSnapshot: nameSnapshot,
    unitAmountCents: unitAmountCentsSnapshot,
    imageSnapshot: imageSnapshot,
    quantity: deltaQuantity,
    addedAt: new Date().toISOString(),
    shippingModeSnapshot: shippingModeSnapshot
  };
  return [...items, newLine];
}

export function setQuantityForProduct(
  items: CartItem[],
  productId: string,
  nextQuantity: number,
  snapshots: CartItemSnapshots
): CartItem[] {
  const {
    nameSnapshot,
    unitAmountCentsSnapshot,
    imageSnapshot,
    shippingModeSnapshot
  } = snapshots;
  // find index
  const index = items.findIndex(
    (line) => softRelId(line.product) === productId
  );
  if (index !== -1) {
    const existing = items[index];
    // findIndex returns -1 if false so to satisfy TS check
    if (existing) {
      if (nextQuantity <= 0)
        return [...items.slice(0, index), ...items.slice(index + 1)];
      const updated: CartItem = {
        ...existing,
        quantity: nextQuantity
      };
      return [...items.slice(0, index), updated, ...items.slice(index + 1)];
    }
  }
  if (nextQuantity <= 0) return items;
  if (index === -1 && nextQuantity > 0) {
    const newLine: CartItem = {
      product: productId,
      nameSnapshot,
      unitAmountCents: unitAmountCentsSnapshot,
      quantity: nextQuantity,
      addedAt: new Date().toISOString(),
      imageSnapshot,
      shippingModeSnapshot
    };
    return [...items, newLine];
  }
  return items;
}

export function removeProduct(
  items: CartItem[],
  productId: string
): CartItem[] {
  const index = items.findIndex(
    (line) => softRelId(line.product) === productId
  );
  if (index === -1) {
    return items;
  }
  return [...items.slice(0, index), ...items.slice(index + 1)];
}
