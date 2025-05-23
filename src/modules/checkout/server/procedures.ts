import { Media, Tenant } from '@/payload-types';
import Stripe from 'stripe';
import z from 'zod';

import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';
import { stripe } from '@/lib/stripe';
import { TRPCError } from '@trpc/server';

import { CheckoutMetadata, ProductMetadata } from '../types';

export const checkoutRouter = createTRPCRouter({
  purchase: protectedProcedure
    .input(
      z.object({
        productIds: z.array(z.string()),
        tenantSlug: z.string().min(1)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const products = await ctx.db.find({
        collection: 'products',
        depth: 2,
        where: {
          and: [
            {
              id: {
                in: input.productIds
              }
            },
            {
              'tenant.slug': {
                equals: input.tenantSlug
              }
            }
          ]
        }
      });
      if (products.totalDocs !== input.productIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Products not found'
        });
      }

      const tenantsData = await ctx.db.find({
        collection: 'tenants',
        limit: 1,
        pagination: false,
        where: {
          slug: {
            equals: input.tenantSlug
          }
        }
      });
      const tenant = tenantsData.docs[0];
      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shop (Tenant) not found '
        });
      }
      // TODO:  Throw error if stripe details not submitted

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        products.docs.map((product) => ({
          quantity: 1,
          price_data: {
            unit_amount: product.price * 100, // stripe calculates prices in cents
            currency: 'usd',
            product_data: {
              name: product.name,
              metadata: {
                stripeAccountId: tenant.stripeAccountId,
                id: product.id,
                name: product.name
              } as ProductMetadata
            }
          }
        }));

      const checkout = await stripe.checkout.sessions.create({
        customer_email: ctx.session.user.email, // this is why in the procedures we spread everything out. Otherwise we get an error saying that the ctx.session.user is possibly null. Which is madness.
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${input.tenantSlug}/checkout?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${input.tenantSlug}/checkout?cancel=true`,
        mode: 'payment',
        line_items: lineItems,
        invoice_creation: {
          enabled: true
        },
        metadata: {
          userId: ctx.session.user.id
        } as CheckoutMetadata
      });

      if (!checkout.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session'
        });
      }
      return { url: checkout.url };
    }),
  getProducts: baseProcedure
    .input(
      z.object({
        ids: z.array(z.string())
      })
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.find({
        collection: 'products',
        depth: 2, // populate category, image, and tenant & tenant.image
        where: {
          id: {
            in: input.ids
          }
        }
      });
      if (data.totalDocs !== input.ids.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Products not found'
        });
      }
      const totalPrice = data.docs.reduce((acc, product) => {
        const price = Number(product.price);
        return acc + (isNaN(price) ? 0 : price);
      }, 0);
      return {
        ...data,
        totalPrice: totalPrice,
        docs: data.docs.map((doc) => ({
          ...doc,
          image: doc.image as Media | null, // settings types so we can get imageURL in product list
          tenant: doc.tenant as Tenant & { image: Media | null } // no need for | null bc Tenant is required for all products
        }))
      };
    })
});
