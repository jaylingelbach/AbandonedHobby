import { headers as getHeaders } from 'next/headers';

import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { stripe } from '@/lib/stripe';
import { TRPCError } from '@trpc/server';

import { loginSchema, registerSchema } from '../schemas';
import { generateAuthCookie } from '../utils';
import { generateTenantURL } from '@/lib/utils';

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();

    const session = ctx.db.auth({ headers });

    return session;
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

      // Email uniqueness (nice to have)
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

      // Normalize slug from username
      const slug = input.username
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Tenant slug uniqueness (defense in depth)
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
        // 1) Create Stripe account for the shop
        const account = await stripe.accounts.create({
          type: 'standard',
          business_type: 'individual',
          business_profile: { url: generateTenantURL(input.username) }
        });
        if (!account) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to create Stripe account.'
          });
        }
        newUser = await ctx.db.create({
          collection: 'users',
          overrideAccess: true, // bypass admin access rules during registration
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            username: input.username,
            password: input.password, // payload will hash
            welcomeEmailSent: false
            // tenants will be set after tenant is created
          }
        });

        // Create the tenant
        tenant = await ctx.db.create({
          collection: 'tenants',
          overrideAccess: true, // bypass create access rule (super-admin only)
          data: {
            name: input.username, // shop display name;
            slug,
            stripeAccountId: account.id,
            stripeDetailsSubmitted: false,
            primaryContact: newUser.id, // REQUIRED relationship—must be a string ID
            notificationEmail: input.email,
            notificationName: input.firstName || input.username
          }
        });

        // Update user to link the tenant in their tenants array
        await ctx.db.update({
          collection: 'users',
          id: newUser.id,
          overrideAccess: true,
          data: {
            tenants: [{ tenant: tenant.id }]
          }
        });
      } catch (error) {
        // optional cleanup if tenant creation failed after user was created
        if (tenant?.id) {
          try {
            await ctx.db.delete({
              collection: 'tenants',
              id: tenant.id,
              overrideAccess: true
            });
          } catch (error) {
            console.error(`Error while creating tenant: ${error}`);
            /* ignore cleanup error */
          }
        }
        if (newUser?.id) {
          try {
            await ctx.db.delete({
              collection: 'users',
              id: newUser.id,
              overrideAccess: true
            });
          } catch (error) {
            console.error(
              `Error while deleting tenant during cleanup: ${error}`
            );
          }
        }

        console.error('Error during registration:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create tenant or user'
        });
      }

      // Login the new user in and set auth cookie
      // const data = await ctx.db.login({
      //   collection: 'users',
      //   data: {
      //     email: input.email,
      //     password: input.password
      //   }
      // });

      // if (!data.token) {
      //   throw new TRPCError({
      //     code: 'UNAUTHORIZED',
      //     message: 'Failed to login'
      //   });
      // }

      // await generateAuthCookie({
      //   prefix: ctx.db.config.cookiePrefix,
      //   value: data.token
      // });
    }),

  login: baseProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const data = await ctx.db.login({
      collection: 'users',
      data: {
        email: input.email,
        password: input.password
      }
    });
    if (!data.token) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Failed to login'
      });
    }

    // cookies.
    await generateAuthCookie({
      prefix: ctx.db.config.cookiePrefix,
      value: data.token
    });
    return data;
  })
});
