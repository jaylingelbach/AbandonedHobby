import { getServerTRPCContext } from '@/trpc/server-context';
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { headers as getHeaders } from 'next/headers';

/**
 * Retrieve the authenticated user associated with a Web `Request` by reusing the server-side tRPC context.
 *
 * @param req - The incoming Web `Request`; its headers are used to construct the server context.
 * @returns The authenticated user from the server session, or `undefined` if no user is authenticated.
 */
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

/**
 * Retrieve the authenticated user from Payload CMS using current request headers.
 *
 * @param _req - Optional NextRequest; ignored and retained only for signature compatibility.
 * @param payloadInstance - Optional initialized Payload instance to use; if omitted, a Payload instance is created from the project config.
 * @returns The authenticated user from the Payload session, or `null` if no user is authenticated.
 */
export async function getAuthUser(
  _req?: NextRequest,
  payloadInstance?: Awaited<ReturnType<typeof getPayload>>
) {
  const payload = payloadInstance ?? (await getPayload({ config }));
  const headers = await getHeaders();

  // 2) Authenticate from the raw headers
  const session = await payload.auth({
    headers: headers
  });

  // 3) Return whatever user (or null) came back
  return session.user;
}
