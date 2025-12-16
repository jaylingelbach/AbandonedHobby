import type { Context } from '@/trpc/init';
import type { CartIdentity } from '@/modules/cart/server/types';
import { readCartSessionIdFromHeaders } from './cart-session-cookie';

/**
 * Determine the cart identity for the incoming request: an authenticated user identity, a guest session identity from the cart session cookie, or `null` if none is available.
 *
 * @param ctx - Request context containing the auth client and HTTP headers used to resolve user and cart session information
 * @returns A `CartIdentity` for an authenticated user (includes `userId` and optional `guestSessionId`) or a guest session identity (`guestSessionId` with `userId` null), or `null` when no identity can be determined
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