import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { stripe } from '@/lib/stripe';
import { TRPCError } from '@trpc/server';

import { loginSchema, registerSchema } from '../schemas';
import { generateAuthCookie } from '../utils';
import { generateTenantURL, resolveReturnToFromHeaders } from '@/lib/utils';
import {
  computeOnboarding,
  toDbUser,
  isSafeReturnTo
} from '@/modules/onboarding/server/utils';
import { posthogServer } from '@/lib/server/posthog-server';

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    return ctx.db.auth({ headers: ctx.headers });
  }),
  register: baseProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const existingByUsername = await ctx.db.find({
        collection: 'users',
        limit: 1,
        where: { username: { equals: input.username } }
      });
      if (existingByUsername.docs[0]) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username already taken, please try another.'
        });
      }

      const existingByEmail = await ctx.db.find({
        collection: 'users',
        limit: 1,
        where: { email: { equals: input.email } }
      });
      if (existingByEmail.docs[0]) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with that email already exists.'
        });
      }

      const slug = input.username
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const existingTenant = await ctx.db.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1
      });
      if (existingTenant.totalDocs > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A tenant with the slug "${slug}" already exists. Please choose a different username.`
        });
      }

      let newUser: { id: string } | null = null;
      let tenant: { id: string } | null = null;

      try {
        const MCC_USED_MERCH = '5932';

        // 1) Create Stripe account for the shop
        const account = await stripe.accounts.create({
          type: 'standard',
          business_type: 'individual',
          business_profile: {
            url: generateTenantURL(slug),
            product_description: `Sell hobby-related items via Abandoned Hobby (peer-to-peer marketplace).`,
            mcc: MCC_USED_MERCH
          }
        });
        if (!account) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to create Stripe account.'
          });
        }

        // 2) Create user
        newUser = await ctx.db.create({
          collection: 'users',
          overrideAccess: true,
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            username: input.username,
            password: input.password,
            welcomeEmailSent: false
          }
        });

        // 3) Create tenant
        tenant = await ctx.db.create({
          collection: 'tenants',
          overrideAccess: true,
          data: {
            name: input.username,
            slug,
            stripeAccountId: account.id,
            stripeDetailsSubmitted: false,
            primaryContact: newUser.id,
            notificationEmail: input.email,
            notificationName: input.firstName || input.username
          }
        });

        // 4) Link tenant to user
        await ctx.db.update({
          collection: 'users',
          id: newUser.id,
          overrideAccess: true,
          data: { tenants: [{ tenant: tenant.id }] }
        });

        // 5) Fetch a fresh user (with tenants/flags) and compute onboarding
        const dbUser = await ctx.db.findByID({
          collection: 'users',
          id: newUser.id,
          depth: 1 // ensure tenants -> { tenant: { slug, productCount, stripeDetailsSubmitted } }
        });

        // normalize Payload shape (_verified may be null; tenants may be null)
        const user = toDbUser({
          id: dbUser.id,
          _verified: dbUser._verified,
          tenants: dbUser.tenants
        });

        const onboarding = computeOnboarding(user);

        // 6) Plumb through a safe returnTo if present (from ctx or headers)
        const returnTo = resolveReturnToFromHeaders(
          ctx.headers,
          isSafeReturnTo
        );

        // 7)  Return shape the client can use to redirect
        return { user, onboarding, returnTo };
      } catch (error) {
        // cleanup on failure
        if (tenant?.id) {
          try {
            await ctx.db.delete({
              collection: 'tenants',
              id: tenant.id,
              overrideAccess: true
            });
          } catch (err) {
            console.error(`Error deleting tenant during cleanup:`, err);
          }
        }
        if (newUser?.id) {
          try {
            await ctx.db.delete({
              collection: 'users',
              id: newUser.id,
              overrideAccess: true
            });
          } catch (err) {
            console.error(`Error deleting user during cleanup:`, err);
          }
        }

        console.error('Error during registration:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create tenant or user'
        });
      }
    }),

  login: baseProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const data = await ctx.db.login({
      collection: 'users',
      data: {
        email: input.email,
        password: input.password
      }
    });
    const isVerified = data.user._verified;
    if (!isVerified) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message:
          'You must verify your account before logging in. Please verify your email to continue. Check your inbox or resend the verification email.'
      });
    }
    if (!data.token) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Failed to login'
      });
    }
    posthogServer?.capture({
      distinctId: data.user.id,
      event: 'userLoggedIn',
      properties: { method: 'password' /* or oauth provider */ }
    });
    // cookies.
    await generateAuthCookie({
      prefix: ctx.db.config.cookiePrefix,
      value: data.token
    });
    return data;
  })
});
