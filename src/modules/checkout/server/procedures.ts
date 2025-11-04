import { randomUUID } from 'crypto';

import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { PLATFORM_FEE_PERCENTAGE } from '@/constants';
import { flushIfNeeded } from '@/lib/server/analytics';
import { posthogServer } from '@/lib/server/posthog-server';
import { asId } from '@/lib/server/utils';
import { stripe } from '@/lib/stripe';
import { generateTenantURL } from '@/lib/utils';
import { usdToCents } from '@/lib/money';
import { Media, Tenant } from '@/payload-types';
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';

import { CheckoutMetadata, ProductMetadata } from '../types';
import { getPrimaryCardImageUrl } from './utils';
import { buildIdempotencyKey } from '@/modules/stripe/idempotency';

import {
  computeFlatShippingCentsForCart,
  type ProductForShipping
} from './utils';

export const runtime = 'nodejs';

const productShippingSchema = z.object({
  shippingMode: z.enum(['free', 'flat', 'calculated']).nullable().optional(),
  shippingFlatFee: z.number().nullable().optional()
});

function parseProductShipping(product: unknown): ProductForShipping {
  const parsed = productShippingSchema.safeParse(product);
  if (!parsed.success) {
    const productId = (product as { id?: string })?.id ?? 'unknown';
    console.warn('[checkout] invalid/missing shipping fields', {
      productId,
      issues: parsed.error.issues
    });
  }
  return {
    id: (product as { id: string }).id,
    shippingMode: parsed.success ? (parsed.data.shippingMode ?? null) : null,
    shippingFlatFee: parsed.success
      ? (parsed.data.shippingFlatFee ?? null)
      : null
  };
}

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
      const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
      if (account.type !== 'standard') {
        await stripe.accounts.update(tenant.stripeAccountId, {
          business_profile: {
            url: generateTenantURL(tenant.slug),
            product_description: `${tenant.name} sells hobby-related items via Abandoned Hobby (peer-to-peer marketplace).`,
            mcc
          }
        });
      } else {
        // Standard accounts manage their own business profile—skip.
        // Keep the log to make future debugging easier.
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

      // Inventory precheck (quantity=1 per product)
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

      // Stripe line items (product price only; shipping added separately)
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

      // Compute product subtotal & platform fee
      const productSubtotalCents = products.reduce(
        (accumulator, current) =>
          accumulator + usdToCents(current.price as unknown as string | number),
        0
      );
      const platformFeeAmount = Math.round(
        (productSubtotalCents * PLATFORM_FEE_PERCENTAGE) / 100
      );

      // compute flat shipping (single checkout-level amount)
      const productsForShipping: ProductForShipping[] =
        products.map(parseProductShipping);

      const { shippingCents, hasCalculated } =
        computeFlatShippingCentsForCart(productsForShipping);

      if (hasCalculated && shippingCents > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Mixing flat-fee and calculated shipping is not supported yet. Please split the cart so we do not undercharge shipping.'
        });
      }

      // Success URL (same as your current behavior)
      const success_url = `${process.env.NEXT_PUBLIC_APP_URL!}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

      // Keep cancel path-based
      const cancel_url = `${process.env.NEXT_PUBLIC_APP_URL!}/checkout?cancel=true`;

      // Read tax readiness to enable automatic tax when available
      let isTaxReady = false;
      try {
        const [settings, registrations] = await Promise.all([
          stripe.tax.settings.retrieve(
            {},
            { stripeAccount: sellerTenant.stripeAccountId }
          ),
          stripe.tax.registrations.list(
            { limit: 1 },
            { stripeAccount: sellerTenant.stripeAccountId }
          )
        ]);
        isTaxReady =
          settings.status === 'active' && registrations.data.length > 0;
      } catch {
        // Non-fatal; proceed without autocalc tax
        isTaxReady = false;
      }

      // Build Checkout Session payload
      const attemptId = randomUUID();
      const sessionPayloadBase: Stripe.Checkout.SessionCreateParams = {
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
          tenantId: String(sellerTenantId),
          tenantSlug: String(sellerTenant.slug),
          sellerStripeAccountId: String(sellerTenant.stripeAccountId),
          productIds: input.productIds.join(','),
          // For visibility in dashboard / troubleshooting
          shippingCents: String(shippingCents)
        } satisfies CheckoutMetadata & { shippingCents: string },

        payment_intent_data: {
          application_fee_amount: platformFeeAmount
        },

        shipping_address_collection: { allowed_countries: ['US'] },
        billing_address_collection: 'required'
      };

      // Add a fixed-amount shipping option when we have a flat fee
      // and NOTHING is calculated per-rate in Checkout (we do a single cart-level fee).
      if (!hasCalculated && shippingCents > 0) {
        sessionPayloadBase.shipping_options = [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: shippingCents, currency: 'usd' },
              display_name: 'Shipping',
              delivery_estimate: {
                minimum: { unit: 'business_day', value: 2 },
                maximum: { unit: 'business_day', value: 7 }
              },
              tax_behavior: 'exclusive'
            }
          }
        ];
      }

      // Derive a deterministic idempotency key to avoid duplicate param mismatch errors
      const stableForKey: {
        mode: Stripe.Checkout.SessionCreateParams.Mode;
        line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
        automatic_tax: Stripe.Checkout.SessionCreateParams.AutomaticTax;
        invoice_creation: Stripe.Checkout.SessionCreateParams.InvoiceCreation;
        customer_email?: string;
        success_url: string;
        cancel_url: string;
        metadata: CheckoutMetadata & { shippingCents: string };
        payment_intent_data?: Stripe.Checkout.SessionCreateParams.PaymentIntentData;
        shipping_address_collection?: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection;
        billing_address_collection?: Stripe.Checkout.SessionCreateParams.BillingAddressCollection;
        shipping_options?: Stripe.Checkout.SessionCreateParams.ShippingOption[];
      } = {
        mode: sessionPayloadBase.mode!,
        line_items: [...(sessionPayloadBase.line_items ?? [])].sort((a, b) => {
          const aMeta = (a.price_data?.product_data?.metadata ??
            {}) as CheckoutMetadata & ProductMetadata;
          const bMeta = (b.price_data?.product_data?.metadata ??
            {}) as CheckoutMetadata & ProductMetadata;
          const aId = String((aMeta as ProductMetadata).id ?? '');
          const bId = String((bMeta as ProductMetadata).id ?? '');
          if (aId !== bId) return aId < bId ? -1 : 1;
          const aAmt = a.price_data?.unit_amount ?? 0;
          const bAmt = b.price_data?.unit_amount ?? 0;
          if (aAmt !== bAmt) return aAmt - bAmt;
          const aQty = a.quantity ?? 0;
          const bQty = b.quantity ?? 0;
          return aQty - bQty;
        }),
        automatic_tax: sessionPayloadBase.automatic_tax!,
        invoice_creation: sessionPayloadBase.invoice_creation!,
        customer_email: sessionPayloadBase.customer_email,
        success_url: sessionPayloadBase.success_url!,
        cancel_url: sessionPayloadBase.cancel_url!,
        metadata: sessionPayloadBase.metadata as CheckoutMetadata & {
          shippingCents: string;
        },
        payment_intent_data: sessionPayloadBase.payment_intent_data,
        shipping_address_collection:
          sessionPayloadBase.shipping_address_collection,
        billing_address_collection:
          sessionPayloadBase.billing_address_collection,
        shipping_options: sessionPayloadBase.shipping_options
      };

      const idempotencyKey = buildIdempotencyKey({
        prefix: 'checkout',
        actorId: user.id,
        tenantId: String(sellerTenantId),
        payload: stableForKey,
        salt: attemptId
      });

      let checkout: Stripe.Checkout.Session;
      try {
        checkout = await stripe.checkout.sessions.create(sessionPayloadBase, {
          stripeAccount: sellerTenant.stripeAccountId,
          idempotencyKey
        });

        // Analytics (non-blocking)
        try {
          posthogServer?.capture({
            distinctId: user.id,
            event: 'checkoutStarted',
            properties: {
              productIds: input.productIds,
              itemCount: products.length,
              productSubtotalCents,
              shippingCents,
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
        } catch (analyticsError) {
          console.warn(
            '[analytics] checkoutStarted capture failed:',
            analyticsError
          );
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

      // Subtotal (items only)
      const subtotalCents = data.docs.reduce(
        (accumulator, product) =>
          accumulator + usdToCents(product.price as unknown as string | number),
        0
      );

      // Flat shipping preview (sum all flat fees; ignore if any are `calculated`)
      const productsForShipping: ProductForShipping[] =
        data.docs.map(parseProductShipping);

      const flat = computeFlatShippingCentsForCart(productsForShipping);

      // If any item is "calculated", Stripe will compute shipping at checkout.
      // For the sidebar we show $0 shipping (preview), so we don't double-charge.
      const shippingCents = flat.hasCalculated ? 0 : flat.shippingCents;

      const totalCents = subtotalCents + shippingCents;

      return {
        ...data,
        // keep legacy totalPrice for existing UI that might read it
        totalPrice: totalCents / 100,
        // new precise fields the UI can use
        subtotalCents,
        shippingCents,
        totalCents,
        docs: data.docs.map((doc) => ({
          ...doc,
          cover: doc.cover as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null },
          cardImageUrl: getPrimaryCardImageUrl(doc)
        }))
      };
    })
});
