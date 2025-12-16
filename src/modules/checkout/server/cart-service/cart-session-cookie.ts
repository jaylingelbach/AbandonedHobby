import { CART_SESSION_COOKIE } from '@/constants';

/**
 * Produce a canonical lowercase hostname from a raw root domain or URL for consistent domain scoping.
 *
 * @param raw - The input root domain or URL; may include a scheme (e.g., "https://") or leading dots. If omitted, returns an empty string.
 * @returns The normalized hostname in lowercase, or an empty string when `raw` is missing or falsy.
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
 * Compute the shared dot-prefixed cookie Domain for a root domain and its subdomains.
 *
 * @param hostname - The request hostname (without port)
 * @param rootDomain - The canonical root domain to match against
 * @returns `.<rootDomain>` if `hostname` equals `rootDomain` or is a subdomain of it, `undefined` otherwise
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
 * Extracts the value of a named cookie from a Cookie header string.
 *
 * @param cookieHeader - The full value of the `Cookie` header (semicolon-separated cookies)
 * @param cookieName - The cookie name to find
 * @returns The cookie value if present and non-empty, `null` otherwise
 */
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

/**
 * Extracts the cart session identifier from the request headers.
 *
 * Looks up the "cookie" header and returns the value of the cart session cookie.
 *
 * @returns The cart session ID string if present, `null` otherwise.
 */
export function readCartSessionIdFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;
  return readCookieFromHeader(cookieHeader, CART_SESSION_COOKIE);
}

/**
 * Extracts the hostname from request headers for cookie domain computation.
 *
 * @param headers - The request Headers object to read the Host header from.
 * @returns The hostname portion of the Host header in lowercase (port removed), or an empty string if missing.
 */
function readHostnameFromHeaders(headers: Headers): string {
  const host = headers.get('host') ?? '';
  return host.split(':')[0]?.toLowerCase() ?? '';
}

/**
 * Build the Set-Cookie header value that clears the cart session cookie.
 *
 * The returned value sets an empty cookie value and attributes (Path=/, Max-Age=0,
 * Expires in the past, SameSite=Lax, HttpOnly) and will include `Secure` in
 * production and a `Domain` attribute when a shared root domain applies.
 *
 * @param headers - Request headers used to derive the request hostname for domain computation
 * @param opts.rootDomainRaw - Optional override for the root domain used to compute a shared cookie Domain (defaults to NEXT_PUBLIC_ROOT_DOMAIN)
 * @param opts.isProd - Optional override to force production behavior; when true the `Secure` attribute is added (defaults to NODE_ENV === "production")
 * @returns The Set-Cookie header value that instructs browsers to clear the cart session cookie
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