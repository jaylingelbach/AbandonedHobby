import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!api/|_next/|_static/|_vercel/|media/|[^/]+\\.[^/]+).*)']
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostHeader = req.headers.get('host') || '';
  let rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';
  if (!rootDomain) {
    console.error('NEXT_PUBLIC_ROOT_DOMAIN environment variable is required');
    return NextResponse.next();
  }
  // Strip any protocol or leading dots:
  rootDomain = rootDomain.replace(/^https?:\/\//, '').replace(/^\./, '');

  // If host doesn’t end with “.${rootDomain}”, skip rewriting:
  if (!hostHeader.toLowerCase().endsWith(`.${rootDomain}`)) {
    return NextResponse.next();
  }

  // Extract and normalize slug:
  const rawSlug = hostHeader.slice(
    0,
    hostHeader.length - `.${rootDomain}`.length
  );
  const tenantSlug = rawSlug.toLowerCase();

  // Validate slug strict‐regex (only lowercase letters, numbers, hyphens):
  if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
    console.warn(`Invalid tenant slug detected: ${rawSlug}`);
    return NextResponse.next();
  }

  try {
    const destination = new URL(
      `/tenants/${tenantSlug}${url.pathname}`,
      req.url
    );
    return NextResponse.rewrite(destination);
  } catch (err) {
    console.error('Failed to rewrite URL in middleware:', err);
    return NextResponse.next();
  }
}
