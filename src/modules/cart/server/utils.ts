import { asId, softRelId } from '@/lib/server/utils';
import type {
  CartDTO,
  CartIdentity,
  CartItemDTO,
  CartItem,
  CartItemSnapshots,
  CartSummaryDTO,
  CartToUpdate,
  PruneSummary,
  IdentityForMerge
} from './types';
import type { Cart, Product, Tenant } from '@/payload-types';
import { Context } from '@/trpc/init';
import { TRPCError } from '@trpc/server';
import { relId } from '@/lib/relationshipHelpers';
import { CART_QUERY_LIMIT } from '@/constants';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { Where } from 'payload';

async function findAllCartsPaged(
  ctx: Context,
  args: {
    where: Where;
    depth?: number;
    sort?: string;
    overrideAccess?: boolean;
    maxPages?: number;
  }
): Promise<Cart[]> {
  const depth = args.depth ?? 1;
  const maxPages = args.maxPages ?? 50;

  const all: Cart[] = [];
  const seenIds = new Set<string>();

  let page = 1;

  for (let pageCount = 0; pageCount < maxPages; pageCount += 1) {
    const res = await ctx.db.find({
      collection: 'carts',
      where: args.where,
      depth,
      sort: args.sort,
      overrideAccess: args.overrideAccess,
      limit: CART_QUERY_LIMIT,
      page
    });

    for (const doc of res.docs as Cart[]) {
      const cartId = String(doc.id);
      if (seenIds.has(cartId)) continue;
      seenIds.add(cartId);
      all.push(doc);
    }

    if (!res.hasNextPage) break;
    page = res.nextPage ?? page + 1;
  }

  return all;
}

/**
 * Constructs a CartDTO representation from a Cart document for the specified tenant.
 *
 * Invalid cart items (missing product id or missing/invalid name, quantity, or unit amount)
 * are omitted from the result; currency is set to `USD`.
 *
 * @param cartDoc - Source cart document containing items and cart id
 * @param tenantId - Tenant identifier to include in the DTO or null
 * @param tenantSlug - Tenant slug to include in the DTO or null
 * @returns A CartDTO containing cartId, tenant context, currency (`USD`), distinct item count,
 *          item list, totalApproxCents (sum of line subtotals), and totalQuantity
 */
export function buildCartDTO(
  cartDoc: Cart,
  tenantId: string | null,
  tenantSlug: string | null
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
 * Find an active cart for the provided identity scoped to a specific tenant.
 *
 * @param identity - The buyer identity; when `kind` is `'user'` looks up carts by `userId`, when `kind` is `'guest'` looks up carts by `guestSessionId`
 * @param tenantId - The tenant id used to scope the search
 * @returns The active cart document for the identity and tenant, or `undefined` if none exists
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

export async function findAllActiveCartsForIdentity(
  ctx: Context,
  identity: CartIdentity
): Promise<Cart[]> {
  if (identity.kind === 'user') {
    return findAllCartsPaged(ctx, {
      where: {
        and: [
          { buyer: { equals: identity.userId } },
          { status: { equals: 'active' } }
        ]
      },
      sort: '-updatedAt',
      depth: 1
    });
  }

  if (identity.kind === 'guest') {
    return findAllCartsPaged(ctx, {
      overrideAccess: true,
      where: {
        and: [
          { guestSessionId: { equals: identity.guestSessionId } },
          { status: { equals: 'active' } }
        ]
      },
      sort: '-updatedAt',
      depth: 1
    });
  }

  return [];
}

export async function findAllActiveCartsForMergeGuestToUser(
  ctx: Context,
  identity: IdentityForMerge
): Promise<{ guestCarts: Cart[]; userCarts: Cart[] }> {
  const { guestSessionId, userId } = identity;
  if (!guestSessionId || !userId) return { guestCarts: [], userCarts: [] };

  const [guestCarts, userCarts] = await Promise.all([
    findAllCartsPaged(ctx, {
      overrideAccess: true,
      where: {
        and: [
          { guestSessionId: { equals: guestSessionId } },
          { status: { equals: 'active' } },
          { buyer: { exists: false } }
        ]
      },
      sort: '-updatedAt',
      depth: 1
    }),
    findAllCartsPaged(ctx, {
      where: {
        and: [{ buyer: { equals: userId } }, { status: { equals: 'active' } }]
      },
      sort: '-updatedAt',
      depth: 1
    })
  ]);

  return { guestCarts, userCarts };
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

/**
 * Create an empty cart summary object with all counts initialized to zero.
 *
 * @returns A `CartSummaryDTO` with `totalQuantity` 0, `distinctItemCount` 0, and `activeCartCount` 0
 */
export function createEmptyCartSummaryDTO(): CartSummaryDTO {
  return {
    totalQuantity: 0,
    distinctItemCount: 0,
    activeCartCount: 0
  };
}

/**
 * Builds a summary of item quantities and counts across multiple carts.
 *
 * @param carts - The carts to summarize
 * @returns An object with `totalQuantity` (sum of all item quantities), `distinctItemCount` (sum of each cart's item count), and `activeCartCount` (number of carts that contain at least one item)
 */
export function buildCartSummaryDTO(carts: Cart[]): CartSummaryDTO {
  let totalQuantity = 0;
  let distinctItemCount = 0;
  let activeCartCount = 0;
  for (const cart of carts) {
    const cartItems = cart?.items ?? [];
    if (cartItems.length > 0) activeCartCount++;

    for (const item of cartItems) {
      totalQuantity += item.quantity ?? 0;
    }
    distinctItemCount += cartItems.length;
  }
  const cartSummary: CartSummaryDTO = {
    totalQuantity,
    distinctItemCount,
    activeCartCount
  };
  return cartSummary;
}

/**
 * Produce a summary of cart items that reference missing or malformed products and collect carts that require updates.
 *
 * @param allCarts - Array of cart documents to scan for missing or malformed items
 * @param missingProductIds - List of product IDs considered missing; any cart item referencing one will be removed
 * @returns An object containing:
 *  - `cartsToUpdate`: list of carts (by id) paired with their filtered `newItems` for persistence,
 *  - `cartsScanned`: total number of carts inspected,
 *  - `itemsRemovedByProductId`: count of items removed because their product ID was in `missingProductIds`,
 *  - `itemsRemovedMalformed`: count of items removed because they were malformed (missing product reference)
 */
export function pruneMissingOrMalformed(
  allCarts: Cart[],
  missingProductIds: string[]
): PruneSummary {
  const cartsScanned = allCarts.length;
  const missingProductIdSet = new Set(missingProductIds);
  // overall counters
  let itemsRemovedByProductId = 0;
  let itemsRemovedMalformed = 0;
  const cartsToUpdate: CartToUpdate[] = [];
  for (const cart of allCarts) {
    const cartItems = cart.items ?? [];
    const cartId = cart.id;

    // per-cart counters
    let removeMissingForCart = 0;
    let removeMalformedForCart = 0;

    // missing or malformed filter
    const newItems = cartItems.filter((item) => {
      if (!item.product) {
        removeMalformedForCart++;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[pruneMissingProducts], Received malformed item: Cart ID: ${cart.id}, product name: ${item.nameSnapshot} `
          );
        }

        return false;
      }
      const productId =
        typeof item.product === 'string' ? item.product : item.product.id;
      const isMissingForThisItem = missingProductIdSet.has(productId);
      if (isMissingForThisItem) {
        removeMissingForCart++;
        return false;
      }
      return true;
    });

    // if either per-cart counter is non-zero: add this cart to cartsToUpdate
    if (removeMalformedForCart > 0 || removeMissingForCart > 0) {
      const cartToUpdate: CartToUpdate = { cartId, newItems };
      cartsToUpdate.push(cartToUpdate);
    }

    itemsRemovedByProductId += removeMissingForCart;
    itemsRemovedMalformed += removeMalformedForCart;
  }
  return {
    cartsToUpdate,
    cartsScanned,
    itemsRemovedByProductId,
    itemsRemovedMalformed
  };
}

/**
 * Persist the provided items array to the cart identified by `cartId`.
 *
 * Replaces the cart's `items` field in the database with `newItems`.
 *
 * @param cartId - ID of the cart to update
 * @param newItems - The array of cart items to store on the cart (replaces existing items)
 */
export async function updateCartItems(
  ctx: Context,
  cartId: string,
  newItems: CartItem[]
): Promise<void> {
  await ctx.db.update({
    collection: 'carts',
    id: cartId,
    overrideAccess: true,
    data: {
      items: newItems
    }
  });
}

export async function mergeCartsPerTenant(
  ctx: Context,
  guestCarts: Cart[],
  userCarts: Cart[],
  userId: string
): Promise<{
  cartsScanned: number;
  cartsMerged: number;
  itemsMoved: number;
  tenantsAffected: number;
}> {
  /**
   * We merge carts "per tenant" because your marketplace is multi-tenant.
   * A cart always belongs to exactly one sellerTenant, so we never merge across tenants.
   *
   * Each tenant group can have:
   * - 0..N guest carts (guestSessionId-based carts)
   * - 0..N user carts  (buyer-based carts)
   */
  type TenantCartGroup = {
    guestCartsForTenant: Cart[];
    userCartsForTenant: Cart[];
  };

  /**
   * tenantGroups:
   * tenantId -> { guest carts for that tenant, user carts for that tenant }
   *
   * This is just grouping; no DB writes happen here.
   */
  const tenantGroups = new Map<string, TenantCartGroup>();

  /**
   * Stats:
   * - cartsScanned: how many cart docs we looked at total
   * - tenantsAffected: number of tenants where we actually changed anything
   * - cartsMerged: number of secondary carts we archived (we "collapsed" them)
   * - itemsMoved: total quantity-units processed from secondary carts into the primary cart
   */
  const cartsScanned = guestCarts.length + userCarts.length;

  let cartsMerged = 0;
  let itemsMoved = 0;
  let tenantsAffected = 0;

  // -------------------------
  // STEP 1: GROUP BY TENANT
  // -------------------------

  // Group guest carts by tenantId
  for (const guestCart of guestCarts) {
    const tenantId = softRelId(guestCart.sellerTenant);
    if (!tenantId) {
      console.warn(
        '[mergeCartsPerTenant] Skipping cart with missing sellerTenant',
        { cartId: guestCart.id }
      );
      continue;
    }

    // Ensure bucket exists
    if (!tenantGroups.has(tenantId)) {
      tenantGroups.set(tenantId, {
        guestCartsForTenant: [],
        userCartsForTenant: []
      });
    }

    tenantGroups.get(tenantId)!.guestCartsForTenant.push(guestCart);
  }

  // Group user carts by tenantId
  for (const userCart of userCarts) {
    const tenantId = asId(userCart.sellerTenant);

    // Ensure bucket exists
    if (!tenantGroups.has(tenantId)) {
      tenantGroups.set(tenantId, {
        guestCartsForTenant: [],
        userCartsForTenant: []
      });
    }

    tenantGroups.get(tenantId)!.userCartsForTenant.push(userCart);
  }

  // -----------------------------------------
  // STEP 2: PER-TENANT MERGE + NORMALIZATION
  // -----------------------------------------
  //
  // NOTE: _tenantId is currently unused, but we keep it because it’s the obvious hook for:
  // - per-tenant debug logs
  // - returning a per-tenant breakdown later
  // - future logic that depends on tenant config (shipping rules, etc.)
  for (const [_tenantId, group] of tenantGroups.entries()) {
    const { guestCartsForTenant, userCartsForTenant } = group;

    /**
     * Our "collapse strategy" is:
     * - Pick ONE cart to become the primary cart for this tenant.
     * - Merge items from all other carts (secondary carts) into that primary cart.
     * - Archive the secondary carts.
     *
     * Primary cart selection rule:
     * - Prefer an existing user cart (buyer cart) if present.
     * - Otherwise use the guest cart and "promote" it (set buyer, clear guestSessionId).
     */
    const [firstUserCart, ...leftOverUserCarts] = userCartsForTenant;

    let primaryCart: Cart;
    let secondaryCarts: Cart[] = [];
    let needsPromotion = false;

    // If absolutely nothing exists for this tenant, skip.
    if (guestCartsForTenant.length === 0 && userCartsForTenant.length === 0) {
      continue;
    }

    // Prefer user cart as primary (already belongs to the user)
    if (firstUserCart) {
      primaryCart = firstUserCart;

      // Secondary carts include:
      // - any extra user carts for this tenant (should be rare but possible)
      // - all guest carts for this tenant
      secondaryCarts = [...leftOverUserCarts, ...guestCartsForTenant];
    } else {
      // No user cart exists; promote a guest cart to become the user's primary cart
      const [firstGuestCart, ...leftOverGuestCarts] = guestCartsForTenant;
      if (!firstGuestCart) continue; // defensive, should not happen given earlier check

      primaryCart = firstGuestCart;
      secondaryCarts = leftOverGuestCarts;
      needsPromotion = true;
    }

    /**
     * We only want to count + write when something actually changes.
     *
     * didAnyWork means:
     * - We have to promote a guest cart into a user cart, OR
     * - We have secondary carts to fold/merge/archive.
     */
    const didAnyWork = needsPromotion || secondaryCarts.length > 0;
    if (!didAnyWork) {
      continue;
    }

    // -----------------------------------------
    // STEP 3: MERGE ITEMS (UNION + SUM QUANTITY)
    // -----------------------------------------
    //
    // mergedByProductId is the core "accumulator":
    // - key: productId
    // - value: CartItem with the correct summed quantity
    //
    // If the same product exists in multiple carts, we sum quantities.
    const mergedByProductId = new Map<string, CartItem>();

    // Start from primary cart items
    const seedItems = Array.isArray(primaryCart.items) ? primaryCart.items : [];

    /**
     * Helper: ensure the CartItem we store always has the correct quantity.
     * (We preserve the rest of the fields on the item.)
     */
    const withQuantity = (item: CartItem, quantity: number): CartItem => {
      return { ...item, quantity };
    };

    /**
     * Upsert behavior:
     * - normalize product relationship -> productId
     * - if product not yet seen: insert
     * - if product already present: sum quantities
     */
    const addOrUpdate = (item: CartItem) => {
      const productId = softRelId(item.product);
      if (!productId) return; // invalid item; skip

      const incomingQuantity = readQuantityOrDefault(item.quantity);
      const existing = mergedByProductId.get(productId);

      if (!existing) {
        mergedByProductId.set(productId, withQuantity(item, incomingQuantity));
        return;
      }

      const nextQuantity =
        readQuantityOrDefault(existing.quantity) + incomingQuantity;

      mergedByProductId.set(productId, withQuantity(existing, nextQuantity));
    };

    // Seed accumulator with primary items
    for (const item of seedItems) {
      addOrUpdate(item);
    }

    /**
     * Fold in secondary carts:
     *
     * itemsMoved (Option 1) counts the total quantity units that came from secondary carts.
     * - This is not "unique items", it's "units moved".
     * - We only count items with a valid productId (same rule as merge).
     */
    for (const cart of secondaryCarts) {
      const cartItems = Array.isArray(cart.items) ? cart.items : [];

      for (const item of cartItems) {
        const productId = softRelId(item.product);
        if (!productId) continue;

        itemsMoved += readQuantityOrDefault(item.quantity);
        addOrUpdate(item);
      }
    }

    // Final merged array to write to the primary cart
    const mergedItems: CartItem[] = Array.from(mergedByProductId.values());

    // -----------------------------------------
    // STEP 4: WRITE PRIMARY CART
    // -----------------------------------------
    //
    // If needsPromotion:
    // - This primary cart used to be a guest cart.
    // - We attach it to the user (buyer=userId) and clear guestSessionId.
    //
    // Else:
    // - Primary cart is already a user cart.
    // - We only write items.
    //
    // overrideAccess is used because this is a backend "system" operation
    // that may run outside normal collection access rules.
    if (needsPromotion) {
      await ctx.db.update({
        collection: 'carts',
        id: String(primaryCart.id),
        overrideAccess: true,
        data: {
          items: mergedItems,
          buyer: userId,
          guestSessionId: null
        }
      });
    } else {
      await ctx.db.update({
        collection: 'carts',
        id: String(primaryCart.id),
        overrideAccess: true,
        data: {
          items: mergedItems
        }
      });
    }

    // -----------------------------------------
    // STEP 5: ARCHIVE SECONDARY CARTS
    // -----------------------------------------
    //
    // We collapse down to one active cart per tenant.
    // Secondary carts get archived (not deleted) to avoid breaking debugging/history.

    const archiveResults = await Promise.allSettled(
      secondaryCarts.map((cart) =>
        ctx.db.update({
          collection: 'carts',
          overrideAccess: true,
          id: cart.id,
          data: { status: 'archived' }
        })
      )
    );

    // Handle partial failures gracefully
    const archiveFailed = archiveResults.filter(
      (r) => r.status === 'rejected'
    ).length;
    if (archiveFailed > 0 && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[mergeCartsPerTenant] Failed to archive ${archiveFailed} carts for tenant`
      );
    }

    // -----------------------------------------
    // STEP 6: UPDATE STATS
    // -----------------------------------------
    //
    // tenantsAffected: one per tenant where we actually changed data
    // cartsMerged: number of carts collapsed/archived
    tenantsAffected += 1;
    cartsMerged += secondaryCarts.length;
  }

  // Return totals for the entire merge operation across all tenants
  return {
    cartsScanned,
    cartsMerged,
    itemsMoved,
    tenantsAffected
  };
}
