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
import { usdToCents } from '@/lib/money';

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
