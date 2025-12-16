import { CART_SESSION_COOKIE } from '@/constants';

/**
 * Normalize a raw root domain or URL into a canonical hostname string.
 * (Matches the behavior in middleware so Domain scoping stays consistent.)
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
 * Returns ".example.com" when hostname is example.com or *.example.com; otherwise undefined.
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

function readCookieFromHeader(
  cookieHeader: string,
  cookieName: string
): string | null {
  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${cookieName}=`)) {
      const value = part.slice(cookieName.length + 1);
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

export function readCartSessionIdFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;
  return readCookieFromHeader(cookieHeader, CART_SESSION_COOKIE);
}

/**
 * Best-effort hostname extraction for cookie Domain computation.
 * In Next/Node this is typically "host". We strip port if present.
 */
function readHostnameFromHeaders(headers: Headers): string {
  const host = headers.get('host') ?? '';
  return host.split(':')[0]?.toLowerCase() ?? '';
}

/**
 * Builds the Set-Cookie header value that clears the cart session cookie.
 *
 * IMPORTANT:
 * - Clearing requires sending Set-Cookie on the RESPONSE.
 * - Domain must match how middleware set it (".rootDomain" vs host-only),
 *   otherwise the browser may keep the original cookie.
 */
export function buildClearCartSessionCookieHeaderValue(
  headers: Headers,
  opts?: {
    /**
     * Override root domain (defaults to NEXT_PUBLIC_ROOT_DOMAIN)
     * Useful for tests.
     */
    rootDomainRaw?: string;
    /**
     * Override environment (defaults to NODE_ENV === "production")
     */
    isProd?: boolean;
  }
): string {
  const hostname = readHostnameFromHeaders(headers);
  const rootDomain = normalizeRootDomain(
    opts?.rootDomainRaw ?? process.env.NEXT_PUBLIC_ROOT_DOMAIN
  );
  const cookieDomain = computeCookieDomain(hostname, rootDomain);

  const isProd = opts?.isProd ?? process.env.NODE_ENV === 'production';

  // Clear cookie: Max-Age=0 + Expires in the past is the most compatible combo.
  // Path + SameSite + HttpOnly should match the original cookie as closely as possible.
  const parts: string[] = [
    `${CART_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
    'HttpOnly'
  ];

  if (isProd) parts.push('Secure');
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);

  return parts.join('; ');
}
