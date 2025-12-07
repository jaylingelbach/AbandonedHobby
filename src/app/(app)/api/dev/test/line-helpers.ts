import type { Media } from '@/payload-types';

import { CartItem } from '@/modules/cart/server/types';
export type ShippingMode = 'free' | 'flat' | 'calculated';

export type IdRef = string | { id: string } | null | undefined;

/**
 * Extracts a string identifier from an IdRef.
 *
 * @param ref - A reference that may be a string, an object with an `id` string, or null/undefined.
 * @returns The string identifier if present, `null` otherwise.
 */
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

/**
 * Adjusts the quantity of the cart line matching `productId`, removing, updating, or adding a line as appropriate.
 *
 * @param items - Current list of cart items
 * @param productId - Identifier of the product to adjust
 * @param deltaQuantity - Quantity to add (positive) or subtract (negative); no-op if `0`
 * @param snapshots - Snapshot values to use when creating a new cart line
 * @returns The updated `CartItem[]`. If the adjusted quantity is <= 0 the line is removed; if the product is absent and `deltaQuantity` > 0 a new line is appended; if `deltaQuantity` is `0` the original array is returned unchanged.
 */
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

/**
 * Set the quantity for the cart item matching `productId`, removing it if `nextQuantity` is less than or equal to zero or adding a new line with provided snapshots if the product is not present and `nextQuantity` is greater than zero.
 *
 * @param items - The current array of cart items
 * @param productId - The product identifier to find or add in the cart
 * @param nextQuantity - The target quantity for the product; if <= 0 the line is removed
 * @param snapshots - Snapshot values (nameSnapshot, unitAmountCentsSnapshot, imageSnapshot, shippingModeSnapshot) used when creating a new cart line
 * @returns The updated array of cart items reflecting the quantity change, removal, or appended new line
 */
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

/**
 * Remove the cart item that matches the provided product ID.
 *
 * @param items - Array of cart items to search
 * @param productId - Product identifier to match against each item's `product` reference
 * @returns A new array with the matching `CartItem` removed, or the original `items` array if no match is found
 */
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