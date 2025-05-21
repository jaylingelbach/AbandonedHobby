import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';

import config from '@payload-config';
import { getPayload } from 'payload';
import { headers as getHeaders } from 'next/headers';
export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' };
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  // transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(async ({ next }) => {
  // instead of making tons of calls to payload and repeating code. Add to context here. (instead of importing in all procedures.)
  const payload = await getPayload({ config });
  // extend context alias as db for readability. We pass the payload cms to authenticate with this as well...
  return next({ ctx: { db: payload } });
});

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const headers = await getHeaders();
  const session = await ctx.db.auth({ headers });

  if (!session.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Must be logged in.'
    });
  }
  // spreading to ensure proper types
  return next({
    ctx: {
      ...ctx,
      session: {
        ...session,
        user: session.user
      }
    }
  });
});
