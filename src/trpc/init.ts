import { initTRPC } from '@trpc/server';
import { cache } from 'react';

import config from '@payload-config';
import { getPayload } from 'payload';
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
  // extend context alias as db for readability
  return next({ ctx: { db: payload } });
});
