import { softRelId } from '@/lib/server/utils';
import type {
  CartDTO,
  CartIdentity,
  CartItemDTO,
  CartItem,
  CartItemSnapshots
} from './types';
import type { Cart, Product, Tenant } from '@/payload-types';
import { Context } from '@/trpc/init';
import { TRPCError } from '@trpc/server';
import { relId } from '@/lib/relationshipHelpers';

/**
 * Constructs a CartDTO representation from a Cart document for the specified tenant.
 *
 * Invalid cart items (missing product id or missing/invalid name, quantity, or unit amount)
 * are omitted from the result; currency is set to `USD`.
 *
 * @param cartDoc - Source cart document containing items and cart id
 * @param tenantId - Tenant identifier to include in the DTO
 * @param tenantSlug - Tenant slug to include in the DTO
 * @returns A CartDTO containing cartId, tenant context, currency (`USD`), distinct item count,
 *          item list, totalApproxCents (sum of line subtotals), and totalQuantity
 */
export function buildCartDTO(
  cartDoc: Cart,
  tenantId: string,
  tenantSlug: string
): CartDTO {
  let approxTotalCents = 0;
  let totalQuantity = 0;
  const itemsForFrontEnd: CartItemDTO[] = [];

  for (const item of cartDoc.items ?? []) {
    const productId = softRelId(item.product);
    if (!productId) {
      console.warn('[buildCartDTO] Missing product id in cart item', {
        cartId: cartDoc.id,
        rawProduct: item.product,
        productId
      });
      continue;
    }

    if (
      !item.nameSnapshot ||
      typeof item.quantity !== 'number' ||
      item.quantity <= 0 ||
      typeof item.unitAmountCents !== 'number' ||
      item.unitAmountCents < 0
    ) {
      console.warn('[buildCartDTO] Invalid cart item fields', {
        cartId: cartDoc.id,
        productId,
        nameSnapshot: item.nameSnapshot,
        quantity: item.quantity,
        unitAmountCents: item.unitAmountCents
      });
      continue;
    }

    const cartItem: CartItemDTO = {
      lineId:
        typeof item.id === 'string' && item.id.trim().length > 0
          ? item.id
          : productId,
      productId,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      lineSubtotalCents: item.unitAmountCents * item.quantity
    };

    itemsForFrontEnd.push(cartItem);
    approxTotalCents += cartItem.lineSubtotalCents;
    totalQuantity += item.quantity;
  }

  const cart: CartDTO = {
    cartId: cartDoc.id,
    tenantSlug,
    currency: 'USD',
    distinctItemCount: itemsForFrontEnd.length,
    items: itemsForFrontEnd,
    tenantId,
    totalApproxCents: approxTotalCents,
    totalQuantity
  };
  return cart;
}

/**
 * Resolve the tenant's id for a given tenant slug.
 *
 * @param tenantSlug - The tenant's slug to look up.
 * @returns The matching tenant's id.
 * @throws TRPCError with code `NOT_FOUND` when no tenant exists for the provided slug.
 */
export async function resolveTenantIdOrThrow(
  ctx: Context,
  tenantSlug: string
): Promise<string> {
  const tenantRes = await ctx.db.find({
    collection: 'tenants',
    limit: 1,
    where: { slug: { equals: tenantSlug } }
  });

  const tenantDoc = tenantRes.docs[0];

  if (!tenantDoc) {
    // this is a tenant problem, not a cart problem
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Tenant not found for the provided slug'
    });
  }

  const tenantId = tenantDoc.id;
  return tenantId;
}

/**
 * Locate an active cart for the given identity within the specified tenant.
 *
 * @param identity - The buyer identity; when `kind` is `'user'` looks up carts by `userId`, when `'guest'` looks up carts by `guestSessionId`
 * @param tenantId - The tenant id to scope the cart search
 * @returns `Cart` if an active cart exists for the identity and tenant, `undefined` otherwise
 */
export async function findActiveCart(
  ctx: Context,
  identity: CartIdentity,
  tenantId: string
): Promise<Cart | undefined> {
  if (identity.kind === 'user') {
    const cartRes = await ctx.db.find({
      collection: 'carts',
      limit: 1,
      where: {
        and: [
          { buyer: { equals: identity.userId } },
          { sellerTenant: { equals: tenantId } },
          { status: { equals: 'active' } }
        ]
      }
    });
    const doc = cartRes.docs[0];
    return doc;
  }
  if (identity.kind === 'guest') {
    const cartRes = await ctx.db.find({
      collection: 'carts',
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { guestSessionId: { equals: identity.guestSessionId } },
          { sellerTenant: { equals: tenantId } },
          { status: { equals: 'active' } }
        ]
      }
    });
    const doc = cartRes.docs[0];

    return doc;
  }
  return undefined; // fallback, should never really happen
}

/**
 * Retrieve an active cart for the given identity and tenant, creating a new active cart if none exists.
 *
 * @param identity - The cart identity (user or guest) used to find or create the cart
 * @param tenantId - The seller tenant's ID the cart belongs to
 * @returns The active `Cart` document for the identity within the specified tenant
 * @throws TRPCError If `identity.kind` is neither `'user'` nor `'guest'` (BAD_REQUEST)
 */
export async function getOrCreateActiveCart(
  ctx: Context,
  identity: CartIdentity,
  tenantId: string
): Promise<Cart> {
  const cart = await findActiveCart(ctx, identity, tenantId);
  if (!cart) {
    if (identity.kind === 'user') {
      const userCart = await ctx.db.create({
        collection: 'carts',
        data: {
          buyer: identity.userId,
          sellerTenant: tenantId,
          status: 'active',
          items: []
        }
      });
      return userCart;
    }

    if (identity.kind === 'guest') {
      const guestCart = await ctx.db.create({
        collection: 'carts',
        overrideAccess: true,
        data: {
          guestSessionId: identity.guestSessionId,
          sellerTenant: tenantId,
          status: 'active',
          items: []
        }
      });
      return guestCart;
    }

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid cart identity kind'
    });
  }
  return cart;
}

/**
 * Load a product by ID and verify it belongs to the specified tenant.
 *
 * Throws a TRPCError when the product is not found, when the product record has no tenant, or when the product's tenant does not match the provided tenant.
 *
 * @param productId - The ID of the product to load
 * @param tenantId - The expected tenant ID that must own the product
 * @param tenantSlug - The tenant slug used for error messaging when tenant mismatch occurs
 * @returns The product document
 * @throws TRPCError with code `NOT_FOUND` if no product with `productId` exists
 * @throws TRPCError with code `INTERNAL_SERVER_ERROR` if the product is missing tenant information
 * @throws TRPCError with code `BAD_REQUEST` if the product's tenant does not match `tenantId`
 */
export async function loadProductForTenant(
  ctx: Context,
  productId: string,
  tenantId: string,
  tenantSlug: string
): Promise<Product> {
  const productRes = await ctx.db.find({
    collection: 'products',
    depth: 0,
    limit: 1,
    where: { id: { equals: productId } }
  });
  const productDoc = productRes.docs[0];
  if (!productDoc) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Product not found'
    });
  }
  const productTenantId = relId<Tenant>(productDoc.tenant);

  if (!productTenantId) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Product is missing tenant'
    });
  }
  if (productTenantId !== tenantId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Product does not belong to ${tenantSlug}`
    });
  }
  return productDoc;
}

/**
 * Adjusts the quantity of a cart line for the specified product, removing the line if quantity becomes <= 0 or appending a new line when increasing quantity for a missing product.
 *
 * @param items - Current list of cart items
 * @param productId - Product identifier used to locate the line to adjust
 * @param deltaQuantity - Quantity increment (positive to add, negative to subtract); no-op when zero
 * @param snapshots - Snapshot values used when creating a new line: `nameSnapshot`, `unitAmountCentsSnapshot`, `imageSnapshot`, and `shippingModeSnapshot`
 * @returns The updated array of `CartItem` reflecting the applied change
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
 * Set the quantity for a product line in a cart, adding, updating, or removing the line as appropriate.
 *
 * If a line for `productId` exists its quantity is updated; if the new quantity is less than or equal to zero the line is removed; if the quantity is unchanged the items array is returned unmodified. If no line exists and `nextQuantity` is greater than zero a new line is appended using values from `snapshots`.
 *
 * @param items - Current array of cart line items
 * @param productId - Product identifier to target
 * @param nextQuantity - Desired quantity for the product line
 * @param snapshots - Snapshot values (name, unit amount, image, shipping mode) used when creating a new line
 * @returns The updated array of cart items after applying the quantity change
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

  const index = items.findIndex(
    (line) => softRelId(line.product) === productId
  );

  if (index !== -1) {
    const existing = items[index];
    if (!existing) return items;

    // if we’re setting to the same quantity, it’s a no-op
    if (existing.quantity === nextQuantity) {
      return items; // same reference → “nothing changed”
    }

    if (nextQuantity <= 0) {
      // remove line
      return [...items.slice(0, index), ...items.slice(index + 1)];
    }

    const updated: CartItem = {
      ...existing,
      quantity: nextQuantity
    };
    return [...items.slice(0, index), updated, ...items.slice(index + 1)];
  }

  // Not found
  if (nextQuantity <= 0) return items;

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

/**
 * Remove the first cart line whose product matches the given product ID.
 *
 * @param items - The array of cart line items
 * @param productId - The product ID to remove from the cart
 * @returns A new array with the first matching line removed; the original `items` array if no match is found
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

/**
 * Create a minimal empty CartDTO for the given tenant slug.
 *
 * @param tenantSlug - The tenant's slug to set on the returned CartDTO
 * @returns A CartDTO with `cartId` and `tenantId` set to `null`, empty `items`, zeroed counts and totals, `currency` set to `'USD'`, and `tenantSlug` set to the provided value
 */
export function createEmptyCart(tenantSlug: string): CartDTO {
  return {
    cartId: null,
    tenantSlug,
    tenantId: null,
    items: [],
    distinctItemCount: 0,
    totalQuantity: 0,
    totalApproxCents: 0,
    currency: 'USD'
  };
}