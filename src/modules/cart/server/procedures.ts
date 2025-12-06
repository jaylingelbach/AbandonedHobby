import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { getCartIdentity } from '@/modules/checkout/server/cart-service/identity';
import type { CartItem, CartItemSnapshots } from './types';
import {
  adjustItemsByProductId,
  buildCartDTO,
  createEmptyCart,
  findActiveCart,
  getOrCreateActiveCart,
  loadProductForTenant,
  resolveTenantIdOrThrow,
  setQuantityForProduct
} from './utils';
import { usdToCents } from '@/lib/money';

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
      const tenantId = await resolveTenantIdOrThrow(ctx, input.tenantSlug);
      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;
      const cart = await getOrCreateActiveCart(ctx, identity, tenantId);
      let nextItems: CartItem[];
      if (input.quantity === 0) {
        const dummySnapshots: CartItemSnapshots = {
          nameSnapshot: '',
          unitAmountCentsSnapshot: 0,
          imageSnapshot: null,
          shippingModeSnapshot: null
        };
        nextItems = setQuantityForProduct(
          cart.items ?? [],
          input.productId,
          input.quantity,
          dummySnapshots
        );
      } else {
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

        nextItems = setQuantityForProduct(
          cart.items ?? [],
          input.productId,
          input.quantity,
          snapshots
        );
      }
      const updatedCart = await ctx.db.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: nextItems
        }
      });
      return buildCartDTO(updatedCart, tenantId, input.tenantSlug);
    }),
  removeItem: baseProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        productId: z.string().min(1)
      })
    )
    .mutation(async ({ ctx, input }) => {}),
  clearCart: baseProcedure
    .input(
      z.object({
        cartId: z.string().min(1)
      })
    )
    .mutation(async ({}) => {})
});
