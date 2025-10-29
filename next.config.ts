import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';
import { POSTHOG } from './src/lib/posthog/config';

const DEFAULT_HOSTNAME = 'ah-gallery-bucket.s3.us-east-2.amazonaws.com';
let imagesHostname: string = DEFAULT_HOSTNAME;
let imagesProtocol: 'http' | 'https' = 'https';

const base = process.env.S3_PUBLIC_BASE_URL;
if (base) {
  try {
    const u = new URL(base);
    if (u.hostname) imagesHostname = u.hostname;
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      imagesProtocol = u.protocol.replace(':', '') as 'http' | 'https';
    }
  } catch {
    /* ignore invalid URL; keep defaults */
  }
}

const tenantPrefix = '/tenants/:slug';
const phx = (prefix: string) => `${prefix}/${POSTHOG.proxyPath}`; // POSTHOG.proxyPath is already sanitized
const rootPhx = () => `/${POSTHOG.proxyPath}`;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: imagesProtocol, hostname: imagesHostname, pathname: '/**' }
    ]
  },
  async rewrites() {
    return [
      // ── Tenant-scoped proxy
      {
        source: `${phx(tenantPrefix)}/array/:token/config.js`,
        destination: `${POSTHOG.assetsHost}/array/:token/config.js`
      },
      {
        source: `${phx(tenantPrefix)}/array/:token/config`,
        destination: `${POSTHOG.apiHost}/array/:token/config`
      },
      {
        source: `${phx(tenantPrefix)}/static/:path*`,
        destination: `${POSTHOG.assetsHost}/static/:path*`
      },
      {
        source: `${phx(tenantPrefix)}/:path*`,
        destination: `${POSTHOG.apiHost}/:path*`
      },

      // ── Root proxy
      {
        source: `${rootPhx()}/array/:token/config.js`,
        destination: `${POSTHOG.assetsHost}/array/:token/config.js`
      },
      {
        source: `${rootPhx()}/array/:token/config`,
        destination: `${POSTHOG.apiHost}/array/:token/config`
      },
      {
        source: `${rootPhx()}/static/:path*`,
        destination: `${POSTHOG.assetsHost}/static/:path*`
      },
      {
        source: `${rootPhx()}/:path*`,
        destination: `${POSTHOG.apiHost}/:path*`
      }
    ];
  },
  // Avoid 308s on proxied paths
  skipTrailingSlashRedirect: true
};

export default withPayload(nextConfig);
