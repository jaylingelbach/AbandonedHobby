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

export const checkoutRouter = createTRPCRouter({
  verify: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const user = await ctx.db.findByID({
        collection: 'users',
        id: ctx.session.user.id,
        depth: 0 // user.tenants[0].tenant will be a string (tenant id)
      });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found.'
        });
      }
      const tenantId = user.tenants?.[0]?.tenant as string; // This is an id bc of depth: 0
      const tenant = await ctx.db.findByID({
        collection: 'tenants',
        id: tenantId
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Could not find tenant with the id of ${tenantId}.`
        });
      }
      if (!tenant.stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tenant does not have a Stripe account configured.'
        });
      }
      // account verification process
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
        productIds: z.array(z.string()),
        tenantSlug: z.string().min(1)
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log('→ entering checkout.purchase');
      console.log(
        '→ STRIPE_SECRET_KEY present?',
        !!process.env.STRIPE_SECRET_KEY,
        'NODE_ENV',
        process.env.NODE_ENV
      );
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
            },
            {
              isArchived: {
                not_equals: true
              }
            }
          ]
        }
      });
      if (products.totalDocs !== input.productIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
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
          message: 'Shop (Tenant) not found'
        });
      }
      // TODO:  Throw error if stripe details not submitted -- remove if verification not needed (changed to account id)
      if (!tenant.stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Stripe details not submitted, not allowed to sell products yet.'
        });
      }

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

      const totalAmount = products.docs.reduce(
        (acc, item) => acc + item.price * 100,
        0
      );

      const platformFeeAmount = Math.round(
        totalAmount * (PLATFORM_FEE_PERCENTAGE / 100)
      );

      const domain = generateTenantURL(input.tenantSlug);

      let checkout;
      try {
        checkout = await stripe.checkout.sessions.create(
          {
            customer_email: ctx.session.user.email, // this is why in the procedures we spread everything out. Otherwise we get an error saying that the ctx.session.user is possibly null. Which is madness.
            success_url: `${domain}/checkout?success=true`,
            cancel_url: `${domain}/checkout?cancel=true`,
            mode: 'payment',
            line_items: lineItems,
            invoice_creation: {
              enabled: true
            },
            metadata: {
              userId: ctx.session.user.id
            } as CheckoutMetadata,
            payment_intent_data: {
              application_fee_amount: platformFeeAmount
            }
          },
          { stripeAccount: tenant.stripeAccountId }
        );
      } catch (error: unknown) {
        if (error && typeof error === 'object') {
          console.error('🔥 stripe checkout error:', {
            message: (error as any).message,
            code: (error as any).code,
            request: {
              id: (error as any).requestId,
              path: (error as any).request?.path,
              method: (error as any).request?.method
            }
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Stripe error: ${(error as any).message}`
          });
        } else {
          console.error('🔥 stripe checkout error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Stripe error: Unknown error'
          });
        }
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
          and: [
            {
              id: {
                in: input.ids
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
