import { initTRPC, TRPCError } from '@trpc/server';

import { headers as getHeaders } from 'next/headers';
import { getPayloadClient } from '@/lib/payload';

export async function createTRPCContext() {
  const raw = await getHeaders();
  const headers = new Headers(raw);

  const db = await getPayloadClient();

  return { db, headers };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create();
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
