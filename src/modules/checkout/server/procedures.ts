import { randomUUID } from 'crypto';

import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { PLATFORM_FEE_PERCENTAGE } from '@/constants';
import { flushIfNeeded } from '@/lib/server/analytics';
import { posthogServer } from '@/lib/server/posthog-server';
import { asId } from '@/lib/server/utils';
import { stripe } from '@/lib/stripe';
import { generateTenantURL, usdToCents } from '@/lib/utils';
import { Media, Tenant } from '@/payload-types';
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';



import { CheckoutMetadata, ProductMetadata } from '../types';
import { getPrimaryCardImageUrl } from './utils';

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

      // Use dbUser (depth:0) and normalize to an id
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
    .input(
      z.object({
        productIds: z
          .array(z.string())
          .min(1, 'At least one product is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      /**
       * Extracts a tenant ID from a Tenant object or tenant ID string.
       *
       * Accepts a Tenant object (with an `id` string) or a plain tenant ID string and returns the tenant ID.
       *
       * @param tenant - A Tenant object, a tenant ID string, or null/undefined.
       * @returns The tenant ID as a string.
       * @throws TRPCError with code `BAD_REQUEST` when `tenant` is null/undefined or does not contain a valid string `id`.
       */
      function getTenantId(tenant: Tenant | string | null | undefined): string {
        if (!tenant) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Product is missing a tenant reference'
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
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Product is missing a valid tenant reference.'
        });
      }
      const uniqueProductIds = Array.from(new Set(input.productIds));
      const productsRes = await ctx.db.find({
        collection: 'products',
        depth: 2,
        where: {
          and: [
            { id: { in: uniqueProductIds } },
            { isArchived: { not_equals: true } }
          ]
        }
      });

      if (productsRes.totalDocs !== uniqueProductIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
        });
      }

      const products = productsRes.docs;

      // Enforce single-seller carts
      const tenantIds = new Set<string>(
        products.map((p) => getTenantId(p.tenant))
      );

      if (tenantIds.size !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All items in the cart must belong to the same seller.'
        });
      }

      // Load seller tenant
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

      const getInventoryInfo = (product: (typeof products)[0]) => {
        const p = product as {
          trackInventory?: boolean;
          stockQuantity?: number;
        };
        return {
          trackInventory: Boolean(p.trackInventory),
          stockQuantity:
            typeof p.stockQuantity === 'number' ? p.stockQuantity : 0
        };
      };

      // Enforce available stock (you sell quantity=1 per product)
      const soldOutNames: string[] = [];
      for (const product of products) {
        const { trackInventory, stockQuantity } = getInventoryInfo(product);
        if (trackInventory && stockQuantity <= 0) {
          soldOutNames.push(product.name ?? 'Item');
        }
      }

      if (soldOutNames.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `These items are sold out: ${soldOutNames.join(', ')}`
        });
      }

      // Build Stripe line items
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        products.map((product) => {
          const unitAmountCents = usdToCents(
            product.price as unknown as string | number
          );
          return {
            quantity: 1,
            price_data: {
              unit_amount: unitAmountCents,
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

      // Compute totals & platform fee
      const totalCents = products.reduce(
        (acc, p) => acc + usdToCents(p.price as unknown as string | number),
        0
      );
      const platformFeeAmount = Math.round(
        (totalCents * PLATFORM_FEE_PERCENTAGE) / 100
      );

      // Success uses subdomain when enabled; otherwise path-based
      const success_url = `${process.env.NEXT_PUBLIC_APP_URL!}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

      // Keep cancel path-based so you don't need a subdomain checkout page
      const cancel_url = `${process.env.NEXT_PUBLIC_APP_URL!}/checkout?cancel=true`;

      let checkout: Stripe.Checkout.Session;
      try {
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
        const attemptId = randomUUID();

        checkout = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            line_items: lineItems,
            client_reference_id: attemptId,
            automatic_tax: { enabled: isTaxReady },
            invoice_creation: { enabled: true },
            customer_email: user.email ?? undefined,
            success_url,
            cancel_url,

            metadata: {
              userId: user.id,
              attemptId,
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
          {
            stripeAccount: sellerTenant.stripeAccountId,
            // 10‑minute window bucket; prevents immediate duplicates but allows later re‑orders
            idempotencyKey: `checkout:${user.id}:${[...input.productIds].sort().join(',')}:${sellerTenantId}:t${Math.floor(Date.now() / (10 * 60 * 1000))}`
          }
        );

        // Analytics (non-blocking)
        try {
          posthogServer?.capture({
            distinctId: user.id,
            event: 'checkoutStarted',
            properties: {
              productIds: input.productIds,
              itemCount: products.length,
              totalCents,
              platformFeeCents: platformFeeAmount,
              stripeSessionId: checkout.id,
              sellerStripeAccountId: sellerTenant.stripeAccountId,
              tenantSlug: sellerTenant.slug,
              tenantId: String(sellerTenantId),
              currency: 'USD',
              $insert_id: `checkout:${checkout.id}`
            },
            groups: { tenant: String(sellerTenantId) },
            timestamp: new Date()
          });

          await flushIfNeeded();
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[analytics] checkoutStarted capture failed:', err);
          }
        }
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

      const totalCents = data.docs.reduce(
        (acc, p) => acc + usdToCents(p.price as unknown as string | number),
        0
      );
      const totalPrice = totalCents / 100; // keep for current UI if needed

      return {
        ...data,
        totalPrice,
        totalCents,
        docs: data.docs.map((doc) => ({
          ...doc,
          // legacy image removed
          cover: doc.cover as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null },
          cardImageUrl: getPrimaryCardImageUrl(doc)
        }))
      };
    })
});
