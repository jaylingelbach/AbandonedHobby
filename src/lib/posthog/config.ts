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

function stripSlashes(segment: unknown): string {
  const s = typeof segment === 'string' ? segment : '';
  return s.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes
}

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
