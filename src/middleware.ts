import { NextRequest, NextResponse } from 'next/server';

const DEVICE_ID_COOKIE = 'ah_device_id';

/** ───────────────────────────── PostHog proxy config ───────────────────────────── */
const PROXY_PATH = (
  process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH ?? '_phx_a1b2c3'
).replace(/^\/+|\/+$/g, ''); // strip leading/trailing slashes safely
const PROXY_SECRET = process.env.POSTHOG_PROXY_SECRET; // optional (server-only)

/** Build a regex that matches:
 *  - "/<PROXY_PATH>/…"
 *  - "/tenants/<slug>/<PROXY_PATH>/…"
 *  - and also exactly "/<PROXY_PATH>" or "/tenants/<slug>/<PROXY_PATH>"
 */
const proxyPathRe = (() => {
  const esc = PROXY_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^/(?:tenants/[^/]+/)?${esc}(?:/|$)`);
})();

/** ───────────────────────────── Helpers ───────────────────────────── */

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

/**
 * Ensure a persistent anonymous device identifier cookie is present on the response.
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

/** ───────────────────────────── Middleware config ───────────────────────────── */

// Keep your broad site middleware + also match explicit proxy paths if you ever change the main matcher.
export const config = {
  matcher: [
    // your existing “all pages except these” rule
    '/((?!api/|_next/|_static/|_vercel/|media/|[^/]+\\.[^/]+).*)',
    // explicit proxy roots (safe even if already covered by the rule)
    `/${PROXY_PATH}`,
    `/${PROXY_PATH}/:path*`,
    `/tenants/:slug/${PROXY_PATH}`,
    `/tenants/:slug/${PROXY_PATH}/:path*`
  ]
};

/** ───────────────────────────── Main middleware ───────────────────────────── */

export default function middleware(req: NextRequest): NextResponse {
  const url = req.nextUrl;
  const hostname = url.hostname.toLowerCase();

  // Gather root domain & whitelist
  let rootDomain = normalizeRootDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  const whitelistEnv = process.env.NEXT_PUBLIC_NON_TENANT_SUBDOMAINS ?? 'www';
  const WHITELIST: string[] = whitelistEnv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  /** ── 1) Gate PostHog proxy paths first (no rewrites), still set device cookie ── */
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

    // Optional shared-secret header gate (protects proxy infra; not a client secret)
    if (PROBLEMATIC_TO_SEND_SECRET_TO_BROWSER() === false && PROXY_SECRET) {
      const provided = req.headers.get('x-posthog-proxy-key');
      if (provided !== PROXY_SECRET) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    // Pass through; set device cookie (scope to root if subdomain matches)
    const res = NextResponse.next();
    const cookieDomainPH = computeCookieDomain(hostname, rootDomain);
    ensureDeviceIdCookie(req, res, cookieDomainPH);
    return res;
  }

  /** ── 2) Regular site flow: if no root domain, just set cookie and continue ── */
  if (!rootDomain) {
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('NEXT_PUBLIC_ROOT_DOMAIN environment variable is required');
    }
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res);
    return res;
  }

  const cookieDomain = `.${rootDomain}`;

  /** ── 3) Don’t rewrite apex or foreign hosts; still set cookie ── */
  if (hostname === rootDomain || !hostname.endsWith(`.${rootDomain}`)) {
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  /** ── 4) Extract tenant slug and enforce whitelist/format ── */
  const rawSlug = hostname.slice(0, hostname.length - `.${rootDomain}`.length);
  const tenantSlug = rawSlug.toLowerCase();

  if (WHITELIST.includes(tenantSlug) || !/^[a-z0-9-]+$/.test(tenantSlug)) {
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }

  /** ── 5) Rewrite to /tenants/<slug>/… and set cookie ── */
  try {
    const destination = new URL(
      `/tenants/${tenantSlug}${url.pathname}${url.search}`,
      req.url
    );
    const res = NextResponse.rewrite(destination);
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to rewrite URL in middleware:', err);
    const res = NextResponse.next();
    ensureDeviceIdCookie(req, res, cookieDomain);
    return res;
  }
}

/** Guard against accidentally inlining a client secret into browser calls.
 *  If you keep the secret server-only (no client fetch with the header), this returns true.
 *  If you ever add a client-side fetch that sets x-posthog-proxy-key, flip this to `true`
 *  only for those server-only call sites and keep it false here.
 */
function PROBLEMATIC_TO_SEND_SECRET_TO_BROWSER(): boolean {
  return false;
}
