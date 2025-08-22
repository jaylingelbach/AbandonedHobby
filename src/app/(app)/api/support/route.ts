import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServerClient } from 'postmark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_DEBUG = process.env.NODE_ENV !== 'production';

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

function getEnv(...names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing env: ${names.join(' or ')}`);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    getEnv('POSTMARK_SERVER_TOKEN');
    const FROM = getEnv('POSTMARK_SUPPORT_FROM_EMAIL', 'POSTMARK_SUPPORT_FROM');
    const TO = getEnv('POSTMARK_SUPPORT_TO_EMAIL', 'POSTMARK_SUPPORT_TO');
    const TEMPLATE_ID_STR = getEnv(
      'POSTMARK_SUPPORT_EMAIL_TEMPLATEID',
      'POSTMARK_SUPPORT_TEMPLATEID'
    );
    const TEMPLATE_ID = Number(TEMPLATE_ID_STR);
    if (!Number.isFinite(TEMPLATE_ID)) {
      return NextResponse.json(
        { ok: false, error: 'Template ID must be numeric' },
        { status: 500 }
      );
    }

    const caseId =
      'SUP-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    await postmark.sendEmailWithTemplate({
      From: FROM,
      To: TO,
      ReplyTo: data.email,
      TemplateId: TEMPLATE_ID,
      TemplateModel: {
        caseId,
        role: data.role,
        topic: data.topic,
        description: data.description,
        reference: data.reference,
        fromAddress: FROM,
        customerEmail: data.email
      },
      MessageStream: process.env.POSTMARK_SUPPORT_STREAM ?? 'outbound'
    });

    return NextResponse.json({ ok: true, caseId }, { status: 200 });
  } catch (err: any) {
    const debug = {
      name: err?.name,
      message: err?.message,
      code: err?.code ?? err?.ErrorCode,
      status: err?.statusCode ?? err?.StatusCode
    };
    console.error('Support route error:', debug); // server logs
    return NextResponse.json(
      {
        ok: false,
        error: DEV_DEBUG ? debug : 'Failed to send support request'
      },
      { status: 502 }
    );
  }
}
