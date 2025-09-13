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
import { generateTenantURL, usdToCents } from '@/lib/utils';
import { asId } from '@/lib/server/utils';
import { posthogServer } from '@/lib/server/posthog-server';

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

      const mcc = '5932';
      const acct = await stripe.accounts.retrieve(tenant.stripeAccountId);
      if (acct.type !== 'standard') {
        await stripe.accounts.update(tenant.stripeAccountId, {
          business_profile: {
            url: generateTenantURL(tenant.slug),
            product_description: `${tenant.name} sells hobby-related items via Abandoned Hobby (peer-to-peer marketplace).`,
            mcc
          }
        });
      } else {
        // Optional: log and proceed to account link creation for Standard accounts
        console.debug(
          `Skipping business_profile update for standard account ${tenant.stripeAccountId}`
        );
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
    // 1) Validate input: an array of product IDs the buyer wants to purchase.
    .input(
      z.object({
        productIds: z
          .array(z.string())
          .min(1, 'At least one product is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 2) Auth guard: require a logged-in user (server-trust boundary).
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // 3) Helper: normalize a tenant reference into a string ID.
      function getTenantId(tenant: Tenant | string | null | undefined): string {
        if (!tenant) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ' Product is missing a tenant reference'
          });
        }
        if (typeof tenant === 'string') return tenant;
        if (
          tenant &&
          typeof tenant === 'object' &&
          typeof tenant.id === 'string'
        ) {
          return tenant.id;
        }
        // If a product lacks a valid tenant, we can’t route money correctly.
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Product is missing a valid tenant reference.'
        });
      }

      // 4) Fetch the products by IDs, excluding archived ones.
      //    Depth 2 so we can access nested/related fields if needed.
      const productsRes = await ctx.db.find({
        collection: 'products',
        depth: 2,
        where: {
          and: [
            { id: { in: input.productIds } },
            { isArchived: { not_equals: true } }
          ]
        }
      });

      // 5) Ensure all requested products were found (guard against stale/invalid IDs).
      if (productsRes.totalDocs !== input.productIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
        });
      }

      const products = productsRes.docs;

      // 6) Enforce single-seller carts: Stripe session is created per seller.
      const tenantIds = new Set<string>(
        products.map((p) => getTenantId(p.tenant))
      );

      if (tenantIds.size !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All items in the cart must belong to the same seller.'
        });
      }

      // 7) Load the seller tenant and validate Stripe config.
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

      // 8) Build Stripe line items from products.
      //    - We price from the database (never trust client-sent prices).
      //    - Attach metadata to help reconcile later (product id/name, account id).
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        products.map((product) => {
          const unitAmountCents = usdToCents(
            product.price as unknown as string | number
          );
          return {
            quantity: 1,
            price_data: {
              unit_amount: unitAmountCents, // integer cents
              tax_behavior: 'exclusive',
              currency: 'usd',
              product_data: {
                name: product.name,
                tax_code: 'txcd_99999999',
                metadata: {
                  stripeAccountId: sellerTenant.stripeAccountId,
                  id: product.id,
                  name: product.name
                } as ProductMetadata
              }
            }
          };
        });

      // 9) Compute totals and platform fee in cents.
      const totalCents = products.reduce(
        (acc, item) =>
          acc + usdToCents(item.price as unknown as string | number),
        0
      );

      const platformFeeAmount = Math.round(
        (totalCents * PLATFORM_FEE_PERCENTAGE) / 100
      );

      // 10) Build domain for seller’s tenant to create success/cancel URLs.
      const domain = generateTenantURL(sellerTenant.slug);

      let checkout: Stripe.Checkout.Session;
      try {
        // 11) Inspect seller’s Stripe Tax readiness so we can switch automatic tax on.
        const [settings, regs] = await Promise.all([
          stripe.tax.settings.retrieve(
            {},
            { stripeAccount: sellerTenant.stripeAccountId }
          ),
          stripe.tax.registrations.list(
            { limit: 1 },
            { stripeAccount: sellerTenant.stripeAccountId }
          )
        ]);

        const isTaxReady = settings.status === 'active' && regs.data.length > 0;

        // 12) Create Checkout Session on the seller’s connected account (direct charge).
        //     - automatic_tax enabled only if the seller is configured.
        //     - invoice_creation so buyers can get receipts.
        //     - application_fee_amount collects your platform fee.
        //     - metadata lets webhooks map session → buyer/seller/products.
        //     - shipping/billing collection enabled for physical goods.
        checkout = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            line_items: lineItems,
            automatic_tax: { enabled: isTaxReady },
            invoice_creation: { enabled: true },
            customer_email: user.email ?? undefined,
            success_url: `${domain}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
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

          // Execute against the seller’s connected account → direct charge.
          { stripeAccount: sellerTenant.stripeAccountId }
        );

        try {
          posthogServer?.capture({
            distinctId: user.id, // <- the buyer
            event: 'checkoutStarted',
            properties: {
              productIds: input.productIds,
              itemCount: products.length,
              totalCents,
              platformFeeCents: platformFeeAmount,
              stripeSessionId: checkout.id,
              sellerStripeAccountId: sellerTenant.stripeAccountId,
              tenantSlug: sellerTenant.slug,
              currency: 'USD',
              $insert_id: `checkout:${checkout.id}` // <- dedupe key (safe to reuse)
            },
            groups: { tenant: String(sellerTenantId) }, // <- top-level groups, not in properties
            timestamp: new Date()
          });

          // In dev/serverless, flush so you actually see the event immediately
          if (process.env.NODE_ENV !== 'production') {
            await posthogServer?.flush?.();
          }
        } catch (err) {
          // Never break checkout because analytics failed
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[analytics] checkoutStarted capture failed:', err);
          }
        }
      } catch (err: unknown) {
        // 13) Surface Stripe-specific errors with useful context.
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
        // 14) Catch-all for unexpected failures.
        console.error('🔥 unknown error in checkout:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unknown error occurred.'
        });
      }

      // 15) Defensive check: ensure we got a redirect URL from Stripe.
      if (!checkout.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session'
        });
      }

      // 16) Return the redirect URL to the client.
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

      const totalCents = data.docs.reduce(
        (acc, p) => acc + usdToCents(p.price as unknown as string | number),
        0
      );
      const totalPrice = totalCents / 100; // keep for current UI if needed

      return {
        ...data,
        totalPrice, // existing consumers
        totalCents, // precise integer for new consumers
        docs: data.docs.map((doc) => ({
          ...doc,
          image: doc.image as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null }
        }))
      };
    })
});
