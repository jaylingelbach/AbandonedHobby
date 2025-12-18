import { NextResponse } from 'next/server';
import { runCartCleanupJob } from '@/scripts/cart-cleanup-job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Validate that the incoming request carries the CRON secret in the Authorization header.
 *
 * @param request - HTTP request whose `Authorization` header will be checked
 * @returns `true` if the `Authorization` header equals `Bearer {CRON_SECRET}`, `false` otherwise (also `false` if `CRON_SECRET` is not set)
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

/**
 * Read and validate a numeric environment variable.
 *
 * @param name - Environment variable name to read
 * @param min - Optional minimum allowed value; values less than `min` are treated as absent
 * @returns The parsed numeric value, or `undefined` if the variable is not set, not a finite number, or below `min`
 */
function parseEnvNumber(name: string, min?: number): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  // If value is below minimum, ignore it and let the caller use its default
  if (min !== undefined && parsed < min) {
    console.warn(
      `[cron/cart-cleanup] ${name}=${parsed} is below minimum ${min}, ignoring`
    );
    return undefined;
  }
  return parsed;
}

/**
 * Handles an authorized cron-triggered cart cleanup and responds with JSON status.
 *
 * @param request - Incoming HTTP request; must include `Authorization: Bearer <CRON_SECRET>` to be authorized.
 * @returns JSON response with shape `{ ok: boolean, result?: any }`. Responses:
 * - 401 when the request is not authorized.
 * - 200 when cleanup completed without errors.
 * - 207 when some deletions succeeded but there were errors.
 * - 500 when cleanup failed entirely or an unexpected error occurred (body will be `{ ok: false }`).
 */
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

    // Return 500 only if no deletions succeeded; partial failures get 207
    const status = result.hadErrors
      ? result.totalDeleted > 0
        ? 207
        : 500
      : 200;
    return NextResponse.json({ ok: !result.hadErrors, result }, { status });
  } catch (error: unknown) {
    console.error('[cron/cart-cleanup] Fatal error');
    if (error instanceof Error) console.error(error.stack ?? error.message);
    else console.error(String(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}