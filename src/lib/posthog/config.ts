export type PosthogConfig = {
  proxyPath: string; // path segment (no slashes)
  apiHost: string; // e.g. https://us.i.posthog.com
  assetsHost: string; // e.g. https://us-assets.i.posthog.com
  uiHost: string; // e.g. https://us.posthog.com
  proxySecret?: string; // optional, for middleware auth
};

function normalizeHost(value: unknown, fallback: string): string {
  const raw =
    typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  return raw.startsWith('http')
    ? raw.replace(/\/+$/, '')
    : `https://${raw.replace(/\/+$/, '')}`;
}

export const POSTHOG: PosthogConfig = {
  proxyPath: process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH ?? '_phx_a1b2c3',
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
  // Optional secret – only used by middleware if set
  proxySecret: process.env.POSTHOG_PROXY_SECRET
};
