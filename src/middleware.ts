import { NextRequest, NextResponse } from 'next/server';
import { POSTHOG } from '@/lib/posthog/config'; // sanitized proxyPath/ui/api hosts

const DEVICE_ID_COOKIE = 'ah_device_id';

/**
 * Normalize a raw root domain or URL into a canonical hostname string.
 *
 * @param raw - The raw root domain or URL (may include protocol like `https://` or leading dots); may be undefined
 * @returns The normalized hostname: protocol removed, leading dots trimmed, and lowercased; empty string if `raw` is missing
 */

function normalizeRootDomain(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^\.+/, '')
    .trim()
    .toLowerCase();
}

/**
 * Determine the shared dot-prefixed cookie domain for a root domain and its subdomains.
 *
 * @param hostname - The request hostname to evaluate (lowercased).
 * @param rootDomain - The normalized root domain to match against (e.g., example.com).
 * @returns `.<rootDomain>` when `hostname` is the root domain or a subdomain of it, `undefined` otherwise.
 */
function computeCookieDomain(
  hostname: string,
  rootDomain: string
): string | undefined {
  if (!rootDomain) return undefined;
  if (hostname === rootDomain) return `.${rootDomain}`;
  if (hostname.endsWith(`.${rootDomain}`)) return `.${rootDomain}`;
  return undefined;
}

/**
 * Ensures an anonymous device identifier cookie exists on the response, creating one if absent.
 *
 * If a device cookie already exists on the request, this function does nothing. When creating a new
 * cookie it sets a persistent identifier with a one-year max age and applies typical cookie
 * attributes (Path '/', SameSite 'lax', HttpOnly false, Secure in production). If `cookieDomain`
 * is provided, the cookie's Domain attribute will be set to that value.
 *
 * @param cookieDomain - Optional domain to apply to the cookie (e.g., ".example.com"); if omitted the cookie will not include a Domain attribute.
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

/** Match:
 *  - "/<proxyPath>" or "/<proxyPath>/…"
 *  - "/tenants/<slug>/<proxyPath>" or "/tenants/<slug>/<proxyPath>/…"
 *  (POSTHOG.proxyPath is already sanitized to a path segment with no slashes)
 */
const proxyPathRe = (() => {
  const esc = POSTHOG.proxyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^/(?:tenants/[^/]+/)?${esc}(?:/|$)`);
})();

/* ───────────────────────────── Middleware config (must be static) ───────────────────────────── */
export const config = {
  matcher: [
    // Broad site middleware; covers proxy paths too.
    '/((?!api/|_next/|_static/|_vercel/|media/|[^/]+\\.[^/]+).*)'
  ]
};

/**
 * Middleware that scopes requests to tenant subdomains, ensures an anonymous device ID cookie,
 * and rewrites tenant subdomain requests to the corresponding `/tenants/<slug>/...` path when applicable.
 *
 * This middleware:
 * - Gates PostHog proxy paths (allowing only GET and specific POST ingest endpoints) while still setting the device cookie.
 * - If no root domain is configured, sets the device cookie and continues.
 * - Leaves apex and foreign hosts unrewritten but sets an appropriately scoped or absent cookie.
 * - For valid tenant subdomains, rewrites the request to `/tenants/<slug><originalPath><query>` and sets a shared cookie.
 * - Falls back to a pass-through response and still sets the cookie on rewrite errors.
 *
 * @param req - The incoming NextRequest
 * @returns A NextResponse with the device ID cookie applied; the response may be a rewrite to a tenant path, a pass-through NextResponse, or an error response for disallowed proxy requests.
 */

export default function middleware(req: NextRequest): NextResponse {
  const url = req.nextUrl;
  const hostname = url.hostname.toLowerCase();

  // Gather root domain & whitelist
  const rootDomain = normalizeRootDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  const whitelistEnv = process.env.NEXT_PUBLIC_NON_TENANT_SUBDOMAINS ?? 'www';
  const WHITELIST: string[] = whitelistEnv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  /* 1) Gate PostHog proxy paths first (no rewrites), still set device cookie */
  if (proxyPathRe.test(url.pathname)) {
    const method = req.method.toUpperCase();
    const isGet = method === 'GET';
    const isPost = method === 'POST';

    // Allow-list methods
    if (!isGet && !isPost) {
      return new NextResponse('Method Not Allowed', { status: 405 });
    }

    // If POST, only allow ingest endpoint (`/e` or `/e/…`)
    if (isPost) {
      // Pattern matches: /[proxyPath]/e or /tenants/[slug]/[proxyPath]/e (+ optional trailing segments)
      const isIngest = /^\/(?:(?:tenants\/[^/]+\/))?[^/]*\/e(?:\/|$)/.test(
        url.pathname
      );
      if (!isIngest) {
        return new NextResponse('Not Allowed', { status: 405 });
      }
    }

    // Optional: origin allow-list for the public proxy (uncomment if you want it)
    // const origin = req.headers.get('origin') ?? '';
    // const allowed = [`https://${rootDomain}`, `https://app.${rootDomain}`].filter(Boolean);
    // if (origin && !allowed.includes(origin)) return new NextResponse('Forbidden', { status: 403 });

    const res = NextResponse.next();
    const cookieDomainPH = computeCookieDomain(hostname, rootDomain); //  unified
    ensureDeviceIdCookie(req, res, cookieDomainPH);
    return res;
  }

  /* 2) Regular site flow: if no root domain, just set cookie and continue */
  if (!rootDomain) {
    if (process.env.NODE_ENV === 'production') {
      console.error('NEXT_PUBLIC_ROOT_DOMAIN environment variable is required');
    }
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  /* 3) Don’t rewrite apex or foreign hosts; still set cookie (shared for apex/subdomains, none for foreign) */
  const sharedCookieDomain = computeCookieDomain(hostname, rootDomain);
  const isForeignHost = sharedCookieDomain === undefined;
  const isApex = hostname === rootDomain;

  if (isApex || isForeignHost) {
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, sharedCookieDomain); // undefined for foreign, .root for apex
    return res;
  }

  /* 4) Extract tenant slug and enforce whitelist/format */
  const rawSlug = hostname.slice(0, hostname.length - `.${rootDomain}`.length);
  const tenantSlug = rawSlug.toLowerCase();

  if (WHITELIST.includes(tenantSlug) || !/^[a-z0-9-]+$/.test(tenantSlug)) {
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, sharedCookieDomain);
    return res;
  }

  /* 5) Rewrite to /tenants/<slug>/… and set cookie */
  try {
    const destination = new URL(
      `/tenants/${tenantSlug}${url.pathname}${url.search}`,
      req.url
    );
    const res = NextResponse.rewrite(destination);
    ensureDeviceIdCookie(req, res, sharedCookieDomain);
    return res;
  } catch (err) {
    console.error(
      '[Middleware] Failed to rewrite URL:',
      err instanceof Error ? err.message : err
    );
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, sharedCookieDomain);
    return res;
  }
}
