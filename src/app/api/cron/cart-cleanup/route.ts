import { NextResponse } from 'next/server';
import { runCartCleanupJob } from '@/scripts/cart-cleanup-job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

function parseEnvNumber(name: string, min?: number): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  if (min !== undefined && parsed < min) {
    console.warn(
      `[cron/cart-cleanup] ${name}=${parsed} is below minimum ${min}, ignoring`
    );
    return undefined;
  }
  return parsed;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const guestAgeDays = parseEnvNumber('GUEST_CART_MAX_AGE_DAYS', 30) ?? 30;
    const emptyAgeDays = parseEnvNumber('EMPTY_CART_MAX_AGE_DAYS', 14);
    const archivedAgeDays = parseEnvNumber('ARCHIVED_CART_MAX_AGE_DAYS', 90);

    const batchSize = parseEnvNumber('CLEANUP_BATCH_SIZE', 1) ?? 250;
    const sleepMs = parseEnvNumber('CLEANUP_SLEEP_MS', 0) ?? 0;
    const maxDelete = parseEnvNumber('CLEANUP_MAX_DELETE', 1);

    const result = await runCartCleanupJob({
      dryRun: false,
      guestAgeDays,
      emptyAgeDays,
      archivedAgeDays,
      batchSize,
      sleepMs,
      maxDelete
    });

    const status = result.hadErrors ? 500 : 200;
    return NextResponse.json({ ok: !result.hadErrors, result }, { status });
  } catch (error: unknown) {
    console.error('[cron/cart-cleanup] Fatal error');
    if (error instanceof Error) console.error(error.stack ?? error.message);
    else console.error(String(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
