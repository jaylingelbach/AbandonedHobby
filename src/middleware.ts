import { NextRequest, NextResponse } from 'next/server';

const DEVICE_ID_COOKIE = 'ah_device_id';

// Generate or ensure a stable anon device id cookie for this visitor.
function ensureDeviceIdCookie(req: NextRequest, res: NextResponse) {
  const hasCookie = !!req.cookies.get(DEVICE_ID_COOKIE)?.value;
  if (hasCookie) return;

  const id =
    (globalThis.crypto && 'randomUUID' in crypto && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`;

  // Secure in prod, lax same-site, 1 year expiry, readable by client.
  const isProd = process.env.NODE_ENV === 'production';
  res.cookies.set(DEVICE_ID_COOKIE, id, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: isProd,
    maxAge: 60 * 60 * 24 * 365 // 1 year
  });
}

export const config = {
  matcher: ['/((?!api/|_next/|_static/|_vercel/|media/|[^/]+\\.[^/]+).*)']
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // We'll always prepare a response object so we can set the cookie on it.
  let res: NextResponse;

  // Never rewrite PostHog beacon paths, but still set the cookie.
  if (url.pathname.startsWith('/_phx_a1b2c3')) {
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  const hostHeader = req.headers.get('host') || '';
  let rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';

  // If no root domain (e.g., local dev), just proceed without rewriting, but still set cookie.
  if (!rootDomain) {
    if (process.env.NODE_ENV === 'production') {
      console.error('NEXT_PUBLIC_ROOT_DOMAIN environment variable is required');
    }
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  // Strip protocol / leading dots for safety.
  rootDomain = rootDomain.replace(/^https?:\/\//, '').replace(/^\./, '');

  // If host doesn’t end with ".<rootDomain>", skip rewriting, but still set cookie.
  if (!hostHeader.toLowerCase().endsWith(`.${rootDomain}`)) {
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  // Extract and normalize slug from subdomain.
  const rawSlug = hostHeader.slice(
    0,
    hostHeader.length - `.${rootDomain}`.length
  );
  const tenantSlug = rawSlug.toLowerCase();

  // Validate slug (lowercase letters, numbers, hyphens).
  if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
    console.warn(`Invalid tenant slug detected: ${rawSlug}`);
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  // Rewrite to /tenants/<slug>/<path>
  try {
    const destination = new URL(
      `/tenants/${tenantSlug}${url.pathname}${url.search}`,
      req.url
    );
    res = NextResponse.rewrite(destination);
  } catch (err) {
    console.error('Failed to rewrite URL in middleware:', err);
    res = NextResponse.next();
  }

  // Always ensure the anon device id is set so SSR can use it safely.
  ensureDeviceIdCookie(req, res);
  return res;
}
