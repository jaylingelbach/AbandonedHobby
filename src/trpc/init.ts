import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';

import config from '@payload-config';
import { getPayload } from 'payload';
import { headers as getHeaders } from 'next/headers';

export const createTRPCContext = cache(async () => {
  const rawHeaders = await getHeaders();
  const headers = new Headers(rawHeaders);

  const db = await getPayload({ config });

  const payload = await getPayload({ config });

  const session = await payload.auth({ headers });
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return {
    db,
    headers,
    session
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
// const t = initTRPC.create({
const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  // transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(async ({ ctx, next }) => {
  // instead of making tons of calls to payload and repeating code. Add to context here. (instead of importing in all procedures.)
  // const payload = await getPayload({ config });
  // extend context alias as db for readability. We pass the payload cms to authenticate with this as well...
  return next({
    ctx: {
      ...ctx // ✅ forwards db, headers, session
    }
  });
});

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await ctx.db.auth({ headers: ctx.headers });

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
