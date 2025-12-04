import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { getCartIdentity } from '@/modules/checkout/server/cart-service/identity';
import type { CartDTO } from './types';
import { buildCartDTO } from './utils';
import { TRPCError } from '@trpc/server';

export const cartRouter = createTRPCRouter({
  getActive: baseProcedure
    .input(z.object({ tenantSlug: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const emptyCart: CartDTO = {
        cartId: null,
        tenantSlug: input.tenantSlug,
        tenantId: null,
        items: [],
        distinctItemCount: 0,
        totalQuantity: 0,
        totalApproxCents: 0,
        currency: 'USD'
      };
      const identity = await getCartIdentity(ctx);
      if (!identity) return emptyCart;

      const tenantRes = await ctx.db.find({
        collection: 'tenants',
        limit: 1,
        where: { slug: { equals: input.tenantSlug } }
      });

      const tenantDoc = tenantRes.docs[0];

      if (!tenantDoc) {
        // this is a tenant problem, not a cart problem
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tenant not found for the provided slug'
        });
      }

      const tenant = tenantDoc.id;
      // if slug doesn't match any tenant throw error

      if (identity.kind === 'user') {
        const cartRes = await ctx.db.find({
          collection: 'carts',
          limit: 1,
          where: {
            and: [
              { buyer: { equals: identity.userId } },
              { sellerTenant: { equals: tenant } },
              { status: { equals: 'active' } }
            ]
          }
        });
        const doc = cartRes.docs[0];

        if (!doc) return emptyCart; // maybe trpc error instead?
        return buildCartDTO(doc, tenant, input.tenantSlug);
      }
      if (identity.kind === 'guest') {
        const cartRes = await ctx.db.find({
          collection: 'carts',
          limit: 1,
          overrideAccess: true,
          where: {
            and: [
              { guestSessionId: { equals: identity.guestSessionId } },
              { sellerTenant: { equals: tenant } },
              { status: { equals: 'active' } }
            ]
          }
        });
        const doc = cartRes.docs[0];
        if (!doc) return emptyCart;
        return buildCartDTO(doc, tenant, input.tenantSlug);
      }
      return emptyCart;
    })
});
