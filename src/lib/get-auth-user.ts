// src/lib/get-auth-user-app.ts
import { getServerTRPCContext } from '@/trpc/server-context';
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers as getHeaders } from 'next/headers';

export async function getAuthUserForApp(req: Request) {
  // Build a “fake” NextApiRequest/Response from the Web Request
  // so you can reuse your server-context logic:
  const url = new URL(req.url);
  const { pathname, search } = url;
  const headers = Object.fromEntries(req.headers.entries());
  //  const body = await req.json().catch(() => ({}));

  // You could spin up a mini-payload context here,
  // or convert Request→NextApiRequest shape.
  const ctx = await getServerTRPCContext({ headers } as any, {} as any);

  return ctx.session.user;
}
// export async function getAuthUser(req: NextRequest) {
//   // 1. Initialize Payload
//   const payload = await getPayload({ config });
//   // 2. Grab the incoming request headers
//   const headers = await getHeaders();
//   // 3. Authenticate
//   const { user } = await payload.auth({ headers: headers });
//   return user; // null if not logged in
// }

export async function getAuthUser(req: NextRequest, res: NextResponse) {
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
