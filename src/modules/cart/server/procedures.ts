import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { getCartIdentity } from '@/modules/checkout/server/cart-service/identity';
import type { CartDTO, CartItemSnapshots } from './types';
import {
  addItemsByProductId,
  buildCartDTO,
  createEmptyCart,
  findActiveCart,
  getOrCreateActiveCart,
  loadProductForTenant,
  resolveTenantIdOrThrow
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

      const nextItems = addItemsByProductId(
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
    })
});
