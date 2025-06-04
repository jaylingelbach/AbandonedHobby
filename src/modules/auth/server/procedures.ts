import { headers as getHeaders } from 'next/headers';

import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';
import { stripe } from '@/lib/stripe';
import { TRPCError } from '@trpc/server';

import { loginSchema, registerSchema } from '../schemas';
import { generateAuthCookie } from '../utils';

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();

    const session = ctx.db.auth({ headers });

    return session;
  }),
  register: baseProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const existingData = await ctx.db.find({
        collection: 'users',
        limit: 1,
        where: {
          username: {
            equals: input.username
          }
        }
      });

      const existingUser = existingData.docs[0];
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username already taken, please try another.'
        });
      }
      try {
        const account = await stripe.accounts.create({
          type: 'standard',
          business_type: 'individual',
          business_profile: {
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://abandonedhobby.com'}/tenants/${input.username}`
          }
        });
        if (!account) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to create Stripe account. '
          });
        }
        const slug = input.username
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const existingTenant = await ctx.db.find({
          collection: 'tenants',
          where: {
            slug: { equals: slug }
          },
          limit: 1
        });

        if (existingTenant.totalDocs > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `A tenant with the slug "${slug}" already exists. Please choose a different username.`
          });
        }
        const tenant = await ctx.db.create({
          collection: 'tenants',
          data: {
            name: input.username,
            slug: slug,
            stripeAccountId: account.id,
            stripeDetailsSubmitted: false
          }
        });

        await ctx.db.create({
          collection: 'users',
          data: {
            email: input.email,
            username: input.username,
            password: input.password, // will be hashed,
            tenants: [
              {
                tenant: tenant.id
              }
            ]
          }
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create tenant or user'
        });
      }

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
