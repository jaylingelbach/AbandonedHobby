import { TRPCError } from '@trpc/server';

import { flushIfNeeded } from '@/lib/server/analytics';
import { posthogServer } from '@/lib/server/posthog-server';
import { stripe } from '@/lib/stripe';
import { generateTenantURL, resolveReturnToFromHeaders } from '@/lib/utils';
import {
  computeOnboarding,
  toDbUser,
  isSafeReturnTo
} from '@/modules/onboarding/server/utils';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';

import { loginSchema, registerSchema } from '../schemas';
import { generateAuthCookie } from '../utils';

/**
 * tRPC router for authentication-related procedures.
 *
 * Exposes three procedures:
 * - `session`  — retrieve the current authenticated session.
 * - `register` — create a new user account, Stripe connected account, and
 *                associated tenant in a single atomic flow.
 * - `login`    — authenticate an existing user and issue a session cookie.
 */

export const authRouter = createTRPCRouter({
  /**
   * Retrieves the current authenticated session for the requesting user.
   *
   * Delegates to the Payload CMS `auth` helper using the incoming request
   * headers so the server can identify the caller from their session cookie.
   *
   * `@returns` The Payload auth session object, or `null` when unauthenticated.
   */

  session: baseProcedure.query(async ({ ctx }) => {
    return ctx.db.auth({ headers: ctx.headers });
  }),

  /**
   * Registers a new user on the Abandoned Hobby platform.
   *
   * Performs the following steps in order:
   * 1. Validates that the requested username and e-mail are not already taken.
   * 2. Derives a URL-safe tenant slug from the username and confirms it is
   *    unique.
   * 3. Creates a Stripe Standard connected account for the seller's shop.
   *    In development the `business_profile.url` field is omitted to avoid
   *    Stripe rejecting localhost URLs.
   * 4. Creates the `users` document in Payload CMS.
   * 5. Creates the `tenants` document linked to the new Stripe account.
   * 6. Links the tenant back to the user record.
   * 7. Computes the user's onboarding state and resolves a safe `returnTo`
   *    URL from request headers.
   *
   * If any step after the Stripe account creation fails, partial data
   * (tenant and/or user) is cleaned up before re-throwing.
   *
   * `@param` input - Validated registration payload conforming to
   *   {`@link` registerSchema}: `firstName`, `lastName`, `email`, `username`,
   *   `password`.
   * `@throws` {TRPCError} `CONFLICT` when the username, e-mail, or derived
   *   slug is already in use.
   * `@throws` {TRPCError} `BAD_REQUEST` when Stripe account creation returns
   *   a falsy result.
   * `@throws` {TRPCError} `INTERNAL_SERVER_ERROR` for any other failure during
   *   the registration flow.
   * `@returns` An object containing the normalised `user`, their `onboarding`
   *   state, and an optional safe `returnTo` URL.
   */

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
        const isDev = process.env.NODE_ENV === 'development';
        const account = await stripe.accounts.create({
          type: 'standard',
          business_type: 'individual',
          business_profile: {
            ...(!isDev && { url: generateTenantURL(slug) }),
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

  /**
   * Authenticates an existing user with e-mail and password credentials.
   *
   * After a successful Payload CMS login the procedure:
   * - Rejects unverified accounts with an `UNAUTHORIZED` error that instructs
   *   the user to confirm their e-mail.
   * - Emits a `userLoggedIn` PostHog event in production (analytics errors
   *   are swallowed to avoid blocking the auth flow).
   * - Writes a signed session cookie via {`@link` generateAuthCookie}.
   *
   * `@param` input - Validated login payload conforming to {`@link` loginSchema}:
   *   `email` and `password`.
   * `@throws` {TRPCError} `UNAUTHORIZED` when the account is unverified or
   *   when Payload does not return a token.
   * `@returns` The raw Payload login response including the `user` object and
   *   session `token`.
   */

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
    if (process.env.NODE_ENV === 'production' && posthogServer) {
      try {
        void posthogServer.capture({
          distinctId: data.user.id,
          event: 'userLoggedIn',
          properties: {
            method: 'password', // or oauth provider
            source: 'server'
          }
        });
        // If deployed on serverless, consider forcing a flush per posthog-node docs.
        flushIfNeeded();
      } catch {
        // Swallow analytics errors to avoid impacting auth.
      }
    }
    // cookies.
    await generateAuthCookie({
      prefix: ctx.db.config.cookiePrefix,
      value: data.token
    });

    return data;
  })
});
