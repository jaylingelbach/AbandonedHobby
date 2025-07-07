// src/lib/get-auth-user-app.ts
import { getServerTRPCContext } from '@/trpc/server-context';
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers as getHeaders } from 'next/headers';

export async function getAuthUserForApp(req: Request) {
  // Build a “fake” NextApiRequest/Response from the Web Request
  // so you can reuse your server-context logic:
  const headers = Object.fromEntries(req.headers.entries());
  //  const body = await req.json().catch(() => ({}));

  // You could spin up a mini-payload context here,
  // or convert Request→NextApiRequest shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = await getServerTRPCContext({ headers } as any);

  return ctx.session.user;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getAuthUser(req: NextRequest) {
  // 1) Bind payload to *this* HTTP request
  const payload = await getPayload({
    config
  });
  const headers = await getHeaders();

  // 2) Authenticate from the raw headers
  const session = await payload.auth({
    headers: headers
  });

  // 3) Return whatever user (or null) came back
  return session.user;
}
