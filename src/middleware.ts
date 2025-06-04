import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/routes
     * 2. /_next (Nextjs internals)
     * 3. /_static (inside /public)
     * 4. all root files inside /public (eg. /favicon)
     */
    '/((?!api/|_next/|_static/|_vercel|media/|[\w-]+\.\w+).*)'
    // '/((?!api/|_next/|_static/|_vercel/|media/|[^/]+\\.[^/]+).*)'
  ]
};

// export default async function middleware(req: NextRequest) {
//   const url = req.nextUrl;
//   // extract hostname (e.g. jay.abandonedhobbies.com || john.localhost:3000)
//   const hostname = req.headers.get('host') || '';
//   const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';

//   // rootDomain is abandonedhobbies.com - in prod
//   if (hostname.endsWith(`.${rootDomain}`)) {
//     const tenantSlug = hostname.replace(`.${rootDomain}`, '');
//     return NextResponse.rewrite(
//       new URL(`/tenants/${tenantSlug}${url.pathname}`, req.url)
//     );
//   }
//   return NextResponse.next();
// }

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';

  console.log('→ Incoming host:', hostname);
  console.log('→ Incoming path:', url.pathname);

  if (hostname.endsWith(`.${rootDomain}`)) {
    const tenantSlug = hostname.replace(`.${rootDomain}`, '');
    const newUrl = new URL(`/tenants/${tenantSlug}${url.pathname}`, req.url);
    console.log('→ Rewriting to:', newUrl.toString());

    return NextResponse.rewrite(newUrl);
  }

  return NextResponse.next();
}
