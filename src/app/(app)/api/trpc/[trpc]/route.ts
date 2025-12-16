import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    responseMeta({ ctx }) {
      const responseHeaders = new Headers();

      if (ctx && typeof ctx === 'object' && 'resHeaders' in ctx) {
        const maybeResHeaders = (ctx as { resHeaders?: unknown }).resHeaders;
        if (maybeResHeaders instanceof Headers) {
          for (const [key, value] of maybeResHeaders.entries()) {
            responseHeaders.append(key, value);
          }
        }
      }

      return { headers: responseHeaders };
    }
  });

export { handler as GET, handler as POST };
