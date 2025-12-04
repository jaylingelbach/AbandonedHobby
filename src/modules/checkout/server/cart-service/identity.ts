import type { Context } from '@/trpc/init';
import { CART_SESSION_COOKIE } from '@/constants';
import type { CartIdentity } from '@/modules/cart/server/types';

/**
 * Extracts the cart session ID stored in the `CART_SESSION_COOKIE` from the request headers' `cookie` header.
 *
 * @param headers - Request headers to read the cookie from
 * @returns The cart session ID string if the `CART_SESSION_COOKIE` is present and non-empty, `null` otherwise
 */
function readCartSessionIdFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${CART_SESSION_COOKIE}=`)) {
      return part.slice(CART_SESSION_COOKIE.length + 1) || null;
    }
  }
  return null;
}

/**
 * Resolve the cart identity from the request context, returning an authenticated user identity, a guest identity derived from the cart session cookie, or `null` if neither is available.
 *
 * @param ctx - Request context containing the database auth client and HTTP headers used for authentication and cookie lookup.
 * @returns A `CartIdentity` for an authenticated user or a guest session, or `null` when no identity can be determined.
 */
export async function getCartIdentity(
  ctx: Context
): Promise<CartIdentity | null> {
  const session = await ctx.db.auth({ headers: ctx.headers });
  const guestSessionId = readCartSessionIdFromHeaders(ctx.headers);

  if (session.user?.id) {
    return {
      kind: 'user',
      userId: session.user.id,
      guestSessionId: guestSessionId ?? null
    };
  }

  if (guestSessionId) {
    return {
      kind: 'guest',
      userId: null,
      guestSessionId
    };
  }

  // Shouldn't really happen, since middleware sets the cookie,
  // but return null so the caller can decide what to do.
  return null;
}