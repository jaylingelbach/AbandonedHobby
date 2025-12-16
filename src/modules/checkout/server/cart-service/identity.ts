import type { Context } from '@/trpc/init';
import type { CartIdentity } from '@/modules/cart/server/types';
import { readCartSessionIdFromHeaders } from './cart-session-cookie';

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
