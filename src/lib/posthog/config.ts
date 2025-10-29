export type PosthogConfig = {
  /** Path segment only, no slashes (sanitized here). */
  proxyPath: string;
  /** Fully-qualified hosts, no trailing slash (normalized). */
  apiHost: string;
  assetsHost: string;
  uiHost: string;
  /** Optional server-only secret for private proxy routes. */
  proxySecret?: string;
};

/**
 * Sanitizes a path segment by removing leading and trailing slashes.
 *
 * @param segment - The value to sanitize; non-string values are treated as an empty string.
 * @returns The input string with leading and trailing slashes removed; returns an empty string for non-string inputs.
 */
function stripSlashes(segment: unknown): string {
  const s = typeof segment === 'string' ? segment : '';
  return s.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes
}

/**
 * Normalize a host value into a fully-qualified URL with no trailing slash.
 *
 * @param value - The input host; if not a non-empty string, `fallback` will be used
 * @param fallback - The host to use when `value` is missing or empty
 * @returns The host prefixed with a protocol (defaults to `https://` if missing) and without trailing slashes
 */
function normalizeHost(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' && value.trim() ? value : fallback;
  const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/g, ''); // strip trailing slash
}

export const POSTHOG: PosthogConfig = {
  proxyPath: stripSlashes(
    process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH ?? '_phx_a1b2c3'
  ),
  apiHost: normalizeHost(
    process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
    'https://us.i.posthog.com'
  ),
  assetsHost: normalizeHost(
    process.env.NEXT_PUBLIC_POSTHOG_ASSETS_HOST,
    'https://us-assets.i.posthog.com'
  ),
  uiHost: normalizeHost(
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    'https://us.posthog.com'
  ),
  proxySecret: process.env.POSTHOG_PROXY_SECRET
};