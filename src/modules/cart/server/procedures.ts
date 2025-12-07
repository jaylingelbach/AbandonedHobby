import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { getCartIdentity } from '@/modules/checkout/server/cart-service/identity';
import type { CartItemSnapshots } from './types';
import {
  adjustItemsByProductId,
  buildCartDTO,
  createEmptyCart,
  findActiveCart,
  getOrCreateActiveCart,
  loadProductForTenant,
  removeProduct,
  resolveTenantIdOrThrow,
  setQuantityForProduct
} from './utils';
import { usdToCents } from '@/lib/money';
import { Cart } from '@/payload-types';

export const cartRouter = createTRPCRouter({
  getActive: baseProcedure
    .input(z.object({ tenantSlug: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const emptyCart = createEmptyCart(input.tenantSlug);
      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;

      // if slug doesn't match any tenant throw error
      const tenantId = await resolveTenantIdOrThrow(ctx, input.tenantSlug);

      const doc = await findActiveCart(ctx, identity, tenantId);

      if (!doc) return emptyCart;
      return buildCartDTO(doc, tenantId, input.tenantSlug);
    }),
  // negative delta allowed for decreasing quantity
  adjustQuantityByDelta: baseProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        productId: z.string().min(1),
        delta: z.number()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const emptyCart = createEmptyCart(input.tenantSlug);
      const tenantId = await resolveTenantIdOrThrow(ctx, input.tenantSlug);
      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;
      const cart = await getOrCreateActiveCart(ctx, identity, tenantId);
      const product = await loadProductForTenant(
        ctx,
        input.productId,
        tenantId,
        input.tenantSlug
      );

      const snapshots: CartItemSnapshots = {
        nameSnapshot: product.name,
        unitAmountCentsSnapshot: usdToCents(product.price),
        imageSnapshot: product.images?.[0]?.image,
        shippingModeSnapshot: product.shippingMode
      };

      const nextItems = adjustItemsByProductId(
        cart.items ?? [],
        input.productId,
        input.delta,
        snapshots
      );
      const updatedCart = await ctx.db.update({
        collection: 'carts',
        overrideAccess: true,
        id: cart.id,
        data: {
          items: nextItems
        }
      });

      return buildCartDTO(updatedCart, tenantId, input.tenantSlug);
    }),
  setQuantity: baseProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        productId: z.string().min(1),
        quantity: z.number().int().min(0)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emptyCart = createEmptyCart(input.tenantSlug);

      // 1) Resolve tenant for this slug
      const tenantId = await resolveTenantIdOrThrow(ctx, input.tenantSlug);

      // 2) Resolve identity (user vs guest); no identity → no cart
      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;

      // 3) Decide how to get the cart:
      //    - quantity === 0 → only use an existing active cart (do NOT create one)
      //    - quantity > 0   → get or create the active cart
      let cart: Cart;

      if (input.quantity === 0) {
        const activeCart = await findActiveCart(ctx, identity, tenantId);
        if (!activeCart) {
          // No existing cart; setting quantity to 0 should be a no-op.
          return emptyCart;
        }
        cart = activeCart;
      } else {
        cart = await getOrCreateActiveCart(ctx, identity, tenantId);
      }

      // 4) Build snapshots:
      //    - For quantity === 0, we can pass dummy snapshots because
      //      setQuantityForProduct won't use them when removing / no-op.
      //    - For quantity > 0, load the real product + snapshots.
      let snapshots: CartItemSnapshots;

      if (input.quantity === 0) {
        snapshots = {
          nameSnapshot: '',
          unitAmountCentsSnapshot: 0,
          imageSnapshot: null,
          shippingModeSnapshot: null
        };
      } else {
        const product = await loadProductForTenant(
          ctx,
          input.productId,
          tenantId,
          input.tenantSlug
        );

        snapshots = {
          nameSnapshot: product.name,
          unitAmountCentsSnapshot: usdToCents(product.price),
          imageSnapshot: product.images?.[0]?.image ?? null,
          shippingModeSnapshot: product.shippingMode
        };
      }

      // 5) Compute the next items array using the pure helper
      const nextItems = setQuantityForProduct(
        cart.items ?? [],
        input.productId,
        input.quantity,
        snapshots
      );

      // 6) Persist the new items on the cart
      const updatedCart = await ctx.db.update({
        collection: 'carts',
        overrideAccess: true,
        id: cart.id,
        data: {
          items: nextItems
        }
      });

      // 7) Return DTO for the client
      return buildCartDTO(updatedCart, tenantId, input.tenantSlug);
    }),
  removeItem: baseProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        productId: z.string().min(1)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emptyCart = createEmptyCart(input.tenantSlug);

      const tenantId = await resolveTenantIdOrThrow(ctx, input.tenantSlug);

      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;

      const cart = await findActiveCart(ctx, identity, tenantId);
      if (!cart) return emptyCart;

      const nextItems = removeProduct(cart.items ?? [], input.productId);

      if (nextItems === cart.items) {
        return buildCartDTO(cart, tenantId, input.tenantSlug);
      }

      const updatedCart = await ctx.db.update({
        collection: 'carts',
        id: cart.id,
        overrideAccess: true,
        data: {
          items: nextItems
        }
      });
      return buildCartDTO(updatedCart, tenantId, input.tenantSlug);
    }),
  clearCart: baseProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emptyCart = createEmptyCart(input.tenantSlug);
      const tenantId = await resolveTenantIdOrThrow(ctx, input.tenantSlug);
      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;
      const cart = await findActiveCart(ctx, identity, tenantId);
      if (!cart) return emptyCart;
      const updatedCart = await ctx.db.update({
        collection: 'carts',
        id: cart.id,
        overrideAccess: true,
        data: {
          items: []
        }
      });
      return buildCartDTO(updatedCart, tenantId, input.tenantSlug);
    })
});
