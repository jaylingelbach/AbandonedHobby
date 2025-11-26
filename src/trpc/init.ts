import { initTRPC, TRPCError } from '@trpc/server';
import { headers as getHeaders } from 'next/headers';

import { getPayloadClient } from '@/lib/payload';
import { CheckoutProductsNotFoundError } from '@/modules/checkout/server/errors';

/**
 * Create the tRPC request context containing the payload client and request headers.
 *
 * @returns An object with `db` — the payload client used for data access, and `headers` — the request `Headers` object for the incoming request
 */
export async function createTRPCContext() {
  const raw = await getHeaders();
  const headers = new Headers(raw);

  const db = await getPayloadClient();

  return { db, headers };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;

    if (cause instanceof CheckoutProductsNotFoundError) {
      // Return a NEW shape whose `data` is shape.data + missingProductIds
      return {
        ...shape,
        data: {
          ...shape.data,
          missingProductIds: cause.missingProductIds
        } as typeof shape.data & { missingProductIds: string[] }
      };
    }

    // Default behavior: just return the original shape
    return shape;
  }
});
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await ctx.db.auth({ headers: ctx.headers });
  if (!session.user)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Must be logged in.'
    });
  return next({ ctx: { ...ctx, session } });
});