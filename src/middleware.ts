import { NextRequest, NextResponse } from 'next/server';
import { POSTHOG } from '@/lib/posthog/config'; // sanitized proxyPath/ui/api hosts

const DEVICE_ID_COOKIE = 'ah_device_id';

/* ───────────────────────────── Helpers ───────────────────────────── */

function normalizeRootDomain(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

function computeCookieDomain(
  hostname: string,
  rootDomain: string
): string | undefined {
  if (!rootDomain) return undefined;
  return hostname.endsWith(`.${rootDomain}`) ? `.${rootDomain}` : undefined;
}

/** Ensure a persistent anonymous device identifier cookie is present on the response. */
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

/* ───────────────────────────── Main middleware ───────────────────────────── */

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
    const cookieDomainPH = computeCookieDomain(hostname, rootDomain);
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

  const cookieDomain = `.${rootDomain}`;

  /* 3) Don’t rewrite apex or foreign hosts; still set cookie */
  if (hostname === rootDomain || !hostname.endsWith(`.${rootDomain}`)) {
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  /* 4) Extract tenant slug and enforce whitelist/format */
  const rawSlug = hostname.slice(0, hostname.length - `.${rootDomain}`.length);
  const tenantSlug = rawSlug.toLowerCase();

  if (WHITELIST.includes(tenantSlug) || !/^[a-z0-9-]+$/.test(tenantSlug)) {
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  /* 5) Rewrite to /tenants/<slug>/… and set cookie */
  try {
    const destination = new URL(
      `/tenants/${tenantSlug}${url.pathname}${url.search}`,
      req.url
    );
    const res = NextResponse.rewrite(destination);
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  } catch (err) {
    console.error('Failed to rewrite URL in middleware:', err);
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }
}
