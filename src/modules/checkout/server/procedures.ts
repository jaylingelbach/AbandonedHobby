import { Media, Tenant } from '@/payload-types';
import Stripe from 'stripe';
import z from 'zod';

import { PLATFORM_FEE_PERCENTAGE } from '@/constants';

import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';
import { stripe } from '@/lib/stripe';
import { TRPCError } from '@trpc/server';

import { CheckoutMetadata, ProductMetadata } from '../types';
import { generateTenantURL } from '@/lib/utils';
import { asId } from '@/lib/server/utils';

export const runtime = 'nodejs';

export const checkoutRouter = createTRPCRouter({
  verify: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Get a depth:0 user so relationships are ids
      const dbUser = await ctx.db.findByID({
        collection: 'users',
        id: user.id,
        depth: 0
      });
      if (!dbUser)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });

      // ✅ Use dbUser (depth:0) and normalize to an id
      const tenantRel = dbUser.tenants?.[0]?.tenant;
      const tenantId = asId(tenantRel);

      const tenant = await ctx.db.findByID({
        collection: 'tenants',
        id: tenantId
      });

      if (!tenant)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Could not find tenant ${tenantId}.`
        });
      if (!tenant.stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tenant does not have a Stripe account configured.'
        });
      }

      const accountLink = await stripe.accountLinks.create({
        account: tenant.stripeAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL!}/admin`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL!}/admin`,
        type: 'account_onboarding'
      });

      if (!accountLink.url) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to create verification link.'
        });
      }
      return { url: accountLink.url };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('Error creating Stripe account link:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create account verification link.'
      });
    }
  }),
  purchase: protectedProcedure
    .input(
      z.object({
        productIds: z.array(z.string())
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      function getTenantId(tenant: Tenant | string | null | undefined): string {
        if (typeof tenant === 'string') return tenant;
        if (
          tenant &&
          typeof tenant === 'object' &&
          typeof tenant.id === 'string'
        ) {
          return tenant.id;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Product is missing a valid tenant reference.'
        });
      }
      const productsRes = await ctx.db.find({
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
              isArchived: {
                not_equals: true
              }
            }
          ]
        }
      });

      if (productsRes.totalDocs !== input.productIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
        });
      }

      const products = productsRes.docs;

      const tenantIds = new Set<string>(
        products.map((p) => getTenantId(p.tenant))
      );

      if (tenantIds.size !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All items in the cart must belong to the same seller.'
        });
      }

      const sellerTenantId = Array.from(tenantIds)[0]!;
      const sellerTenant = await ctx.db.findByID({
        collection: 'tenants',
        id: sellerTenantId
      });

      if (!sellerTenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Seller (Tenant) not found'
        });
      }
      if (!sellerTenant.stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seller has no Stripe account configured.'
        });
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        products.map((product) => ({
          quantity: 1,
          price_data: {
            unit_amount: Math.round(Number(product.price) * 100),
            currency: 'usd',
            product_data: {
              name: product.name,
              metadata: {
                stripeAccountId: sellerTenant.stripeAccountId,
                id: product.id,
                name: product.name
              } as ProductMetadata
            }
          }
        }));

      const totalAmount = products.reduce(
        (acc, item) => acc + Math.round(Number(item.price) * 100),
        0
      );

      const platformFeeAmount = Math.round(
        totalAmount * (PLATFORM_FEE_PERCENTAGE / 100)
      );

      const domain = generateTenantURL(sellerTenant.slug);

      let checkout: Stripe.Checkout.Session;
      try {
        checkout = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            line_items: lineItems,
            invoice_creation: {
              enabled: true
            },
            customer_email: user.email ?? undefined,
            success_url: `${domain}/checkout?success=true`,
            cancel_url: `${domain}/checkout?cancel=true`,
            metadata: {
              userId: user.id,
              tenantId: String(sellerTenantId),
              tenantSlug: String(sellerTenant.slug),
              sellerStripeAccountId: String(sellerTenant.stripeAccountId),
              productIds: input.productIds.join(',')
            } as CheckoutMetadata,

            payment_intent_data: {
              application_fee_amount: platformFeeAmount
            },

            shipping_address_collection: { allowed_countries: ['US'] },
            billing_address_collection: 'required'
          },
          { stripeAccount: sellerTenant.stripeAccountId }
        );
      } catch (err: unknown) {
        if (err instanceof Stripe.errors.StripeError) {
          console.error('🔥 stripe checkout error:', {
            message: err.message,
            code: err.code,
            requestId: err.requestId
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Stripe error: ${err.message}`
          });
        }
        console.error('🔥 unknown error in checkout:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unknown error occurred.'
        });
      }

      if (!checkout.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session'
        });
      }

      return { url: checkout.url };
    }),

  getProducts: baseProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.find({
        collection: 'products',
        depth: 2,
        where: {
          and: [{ id: { in: input.ids } }, { isArchived: { not_equals: true } }]
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
        totalPrice,
        docs: data.docs.map((doc) => ({
          ...doc,
          image: doc.image as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null }
        }))
      };
    })
});
