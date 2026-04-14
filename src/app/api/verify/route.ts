import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';

import config from '@payload-config';

export const runtime = 'nodejs';

/**
 * Handle email verification requests by validating a `token` query parameter and redirecting the client based on the result.
 *
 * If `token` is missing the client is redirected to `/sign-in?verified=0&reason=missing`. If verification succeeds the client is redirected to `/sign-in?verified=1&next=%2Fwelcome`. If verification fails the client is redirected to `/sign-in?verified=0&reason=invalid`.
 *
 * @param req - The incoming Next.js request; expects a `token` query parameter on the URL.
 * @returns A NextResponse that redirects the client to the appropriate sign-in URL based on presence and validity of the token.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token)
    return NextResponse.redirect(
      new URL('/sign-in?verified=0&reason=missing', req.url)
    );

  try {
    const payload = await getPayload({ config });
    await payload.verifyEmail({ collection: 'users', token });

    return NextResponse.redirect(new URL('/sign-in?verified=1&next=%2Fwelcome', req.url));
  } catch (error) {
    console.error('[verify] failed to verify email:', error);
    return NextResponse.redirect(
      new URL('/sign-in?verified=0&reason=invalid', req.url)
    );
  }
}
