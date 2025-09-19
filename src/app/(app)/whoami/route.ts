import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getCookieToken(cookieHeader: string, name = 'payload-token') {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = getCookieToken(cookieHeader, 'payload-token');

  // decode exp for quick “is it expired?” check (optional)
  let exp: number | null = null;
  let expired: boolean | null = null;
  try {
    if (token) {
      const json = Buffer.from(token.split('.')[1]!, 'base64').toString('utf8');
      const claims = JSON.parse(json);
      exp = typeof claims?.exp === 'number' ? claims.exp : null;
      if (exp) expired = Math.floor(Date.now() / 1000) > exp;
    }
  } catch {
    // ignore decode errors
  }

  const payload = await getPayload({ config });

  // Try both ways Payload accepts auth in App Router:
  const viaAuthJWT = await payload.auth({ headers: req.headers }); // reads cookie header
  const bearerHeaders = new Headers(req.headers);
  if (token) bearerHeaders.set('authorization', `JWT ${token}`);
  const viaAuthBearer = await payload.auth({ headers: bearerHeaders });

  let userByIdExists = false;
  try {
    const claimId =
      (viaAuthJWT?.user as any)?.id ?? (viaAuthBearer?.user as any)?.id ?? null;
    if (claimId) {
      await payload.findByID({ collection: 'users', id: claimId, depth: 0 });
      userByIdExists = true;
    }
  } catch {
    userByIdExists = false;
  }

  return NextResponse.json({
    cookieName: 'payload-token',
    hasCookieHeader: Boolean(cookieHeader),
    hasTokenCookie: Boolean(token),
    exp,
    expired,
    userViaCookieNull: !viaAuthJWT?.user,
    userViaAuthNull: !viaAuthBearer?.user,
    userByIdExists
  });
}
