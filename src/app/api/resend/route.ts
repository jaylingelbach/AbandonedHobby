import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import z from 'zod';
import {
  buildWelcomeVerifyHTML,
  buildWelcomeVerifySubject
} from '@/lib/email/welcome-verify';
import { User } from '@/payload-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Email required' },
      { status: 400 }
    );
  }
  const { email } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const payload = await getPayload({ config });

  // Don’t leak account existence: always 200 unless the request is malformed.
  try {
    const res = await payload.find({
      collection: 'users',
      where: { email: { equals: normalizedEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true // Need hidden fields to access _verified / _verificationToken
    });

    const user = res.docs[0] as User | undefined;

    // If user not found or already verified, still return 200 (no info leak)
    if (!user || user._verified) {
      return NextResponse.json({ ok: true });
    }

    const token: string | null = user._verificationToken ?? null;
    if (!token) {
      // Preserve indistinguishability; optionally log for internal follow-up.
      console.warn('[resend] user missing _verificationToken; no email sent');
      return NextResponse.json({ ok: true });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'http://localhost:3000';

    const subject = buildWelcomeVerifySubject(user);
    const html = buildWelcomeVerifyHTML({ token, user, appUrl });

    // Use the configured email adapter (Nodemailer + Postmark in your config)
    await payload.sendEmail({
      to: email,
      subject,
      html
      // Optionally set from; defaults come from your nodemailerAdapter config:
      // from: 'Jay from abandoned hobby <jay@abandonedhobby.com>',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend] error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
