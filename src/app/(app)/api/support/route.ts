import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ServerClient } from 'postmark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  role: z.enum(['buyer', 'seller']),
  topic: z.enum([
    'Order',
    'Listing',
    'Payout',
    'Account',
    'Bug',
    'Abuse/Report'
  ]),
  reference: z.string().max(500).optional().default(''),
  email: z.string().email(),
  description: z.string().min(10).max(5000)
});

const postmark = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    // TODO: (nice-to-have): rate-limit per IP/user; verify session; normalize reference; log to DB
    const caseId =
      'SUP-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await postmark.sendEmailWithTemplate({
      From: process.env.POSTMARK_SUPPORT_FROM!, // e.g. support@abandonedhobby.com (verified domain)
      To: process.env.POSTMARK_SUPPORT_TO!, // your support inbox
      ReplyTo: data.email, // user's email (don’t put user in From)
      TemplateId: Number(process.env.POSTMARK_SUPPORT_TEMPLATE_ID!),
      TemplateModel: { caseId, ...data },
      MessageStream: process.env.POSTMARK_SUPPORT_STREAM ?? 'outbound'
    });
    return NextResponse.json({ ok: true, caseId }, { status: 200 });
  } catch (error) {
    console.error('Postmark send failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to send support request' },
      { status: 502 }
    );
  }
}
