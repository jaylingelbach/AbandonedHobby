import { getPayload } from 'payload';
import config from '@payload-config';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token)
    return NextResponse.redirect(
      new URL('/sign-in?verified=0&reason=missing', req.url)
    );

  try {
    const payload = await getPayload({ config });
    await payload.verifyEmail({ collection: 'users', token });

    return NextResponse.redirect(new URL('/sign-in?verified=1', req.url));
  } catch (error) {
    console.error('[verify] failed to verify email:', error);
    return NextResponse.redirect(
      new URL('/sign-in?verified=0&reason=invalid', req.url)
    );
  }
}
