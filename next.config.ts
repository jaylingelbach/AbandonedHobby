// next.config.ts
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

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
    // ignore invalid URL; keep defaults
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: imagesProtocol, hostname: imagesHostname, pathname: '/**' }
    ]
  },
  async rewrites() {
    return [
      // ───────── Tenant-prefixed PostHog proxy ─────────
      // Array config (script) → assets host
      {
        source: '/tenants/:slug/_phx_a1b2c3/array/:token/config.js',
        destination: 'https://us-assets.i.posthog.com/array/:token/config.js'
      },
      // Array config (JSON) → API host
      {
        source: '/tenants/:slug/_phx_a1b2c3/array/:token/config',
        destination: 'https://us.i.posthog.com/array/:token/config'
      },
      // Static assets (recorder, workers, etc.) → assets host
      {
        source: '/tenants/:slug/_phx_a1b2c3/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      // Catch-all API → API host
      {
        source: '/tenants/:slug/_phx_a1b2c3/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      },

      // ───────── Root PostHog proxy ─────────
      // Array config (script) → assets host
      {
        source: '/_phx_a1b2c3/array/:token/config.js',
        destination: 'https://us-assets.i.posthog.com/array/:token/config.js'
      },
      // Array config (JSON) → API host
      {
        source: '/_phx_a1b2c3/array/:token/config',
        destination: 'https://us.i.posthog.com/array/:token/config'
      },
      // Static assets → assets host
      {
        source: '/_phx_a1b2c3/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      // Catch-all API → API host
      {
        source: '/_phx_a1b2c3/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      }
    ];
  },
  // Required so PostHog endpoints with/without trailing slashes don’t redirect
  skipTrailingSlashRedirect: true
};

export default withPayload(nextConfig);
