// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const DEVICE_ID_COOKIE = 'ah_device_id';

/**
 * Ensure an anon device id cookie exists.
 * - Shared across subdomains when cookieDomain is provided (e.g., .example.com)
 * - 1 year lifetime, SameSite Lax, HttpOnly=false (client readable), Secure in prod
 */
function ensureDeviceIdCookie(
  req: NextRequest,
  res: NextResponse,
  cookieDomain?: string
): void {
  const existing = req.cookies.get(DEVICE_ID_COOKIE)?.value;
  if (existing) return;

  const id =
    (globalThis.crypto && 'randomUUID' in crypto && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const isProd = process.env.NODE_ENV === 'production';
  res.cookies.set(DEVICE_ID_COOKIE, id, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: isProd,
    maxAge: 60 * 60 * 24 * 365, // 1 year
    ...(cookieDomain ? { domain: cookieDomain } : {})
  });
}

export const config = {
  matcher: ['/((?!api/|_next/|_static/|_vercel/|media/|[^/]+\\.[^/]+).*)']
};

export default function middleware(req: NextRequest): NextResponse {
  const url = req.nextUrl;
  const hostname = url.hostname.toLowerCase();

  // Collect config
  let rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '';
  // Comma-separated list of non-tenant subs to skip rewriting (e.g., "www,app")
  const whitelistEnv = process.env.NEXT_PUBLIC_NON_TENANT_SUBDOMAINS ?? 'www';
  const WHITELIST: string[] = whitelistEnv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  // We’ll always prepare a response so we can mutate cookies deterministically.
  let res: NextResponse;

  // Never rewrite PostHog beacon paths, but do set the cookie.
  if (url.pathname.startsWith('/_phx_a1b2c3')) {
    res = NextResponse.next();
    // For PostHog calls we may not be on a tenant host; omit domain if not applicable.
    const cookieDomainPH =
      rootDomain &&
      hostname.endsWith(
        `.${rootDomain.replace(/^https?:\/\//, '').replace(/^\./, '')}`
      )
        ? `.${rootDomain.replace(/^https?:\/\//, '').replace(/^\./, '')}`
        : undefined;
    ensureDeviceIdCookie(req, res, cookieDomainPH);
    return res;
  }

  // If no root domain (e.g., local dev without config), just pass through but set cookie (no domain attr).
  if (!rootDomain) {
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('NEXT_PUBLIC_ROOT_DOMAIN environment variable is required');
    }
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  // Normalize root domain (strip protocol/leading dot)
  rootDomain = rootDomain.replace(/^https?:\/\//, '').replace(/^\./, '');
  const cookieDomain = `.${rootDomain}`;

  // If host is exactly the apex root domain, skip rewriting (not a tenant subdomain).
  if (hostname === rootDomain) {
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  // If host isn’t a subdomain of the root domain, skip rewriting.
  if (!hostname.endsWith(`.${rootDomain}`)) {
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  // Extract the left-most label(s) as the tenant slug.
  const rawSlug = hostname.slice(0, hostname.length - `.${rootDomain}`.length);
  const tenantSlug = rawSlug.toLowerCase();

  // Whitelist non-tenant subs (e.g., "www", "app")
  if (WHITELIST.includes(tenantSlug)) {
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  // Validate tenant slug (lowercase letters, numbers, hyphens)
  if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
    // eslint-disable-next-line no-console
    console.warn(`Invalid tenant slug detected: ${rawSlug}`);
    res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  // Rewrite: /tenants/<slug>/<path>?<search>
  try {
    const destination = new URL(
      `/tenants/${tenantSlug}${url.pathname}${url.search}`,
      req.url
    );
    res = NextResponse.rewrite(destination);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to rewrite URL in middleware:', err);
    res = NextResponse.next();
  }

  // Always ensure anon device id cookie is set and shared across subdomains.
  ensureDeviceIdCookie(req, res, cookieDomain);
  return res;
}
