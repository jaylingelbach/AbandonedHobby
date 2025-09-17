// next.config.ts
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const DEFAULT_HOSTNAME = 'ah-gallery-bucket.s3.us-east-2.amazonaws.com';
let imagesHostname = DEFAULT_HOSTNAME as string;
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
      {
        protocol: imagesProtocol,
        hostname: imagesHostname,
        pathname: '/**'
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/tenants/:slug/_phx_a1b2c3/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/tenants/:slug/_phx_a1b2c3/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      },
      {
        source: '/_phx_a1b2c3/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/_phx_a1b2c3/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      }
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true
};

export default withPayload(nextConfig);
