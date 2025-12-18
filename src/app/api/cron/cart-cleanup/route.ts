import { NextResponse } from 'next/server';
import { runCartCleanupJob } from '@/scripts/cart-cleanup-job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Validates that the incoming request carries the expected cron secret in its Authorization header.
 *
 * @param request - The incoming HTTP request to check.
 * @returns `true` if the Authorization header exactly matches `Bearer <CRON_SECRET>` (with `CRON_SECRET` taken from the environment), `false` otherwise or if `CRON_SECRET` is not set.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

/**
 * Parse an environment variable into a finite number and enforce an optional minimum.
 *
 * @param name - The environment variable name to read.
 * @param min - Optional minimum allowed value; values less than `min` are treated as missing.
 * @returns The parsed numeric value, or `undefined` if the variable is not set, not a finite number, or is less than `min`.
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
 * Handles the cron cart cleanup GET route.
 *
 * Validates a Bearer token in the request's Authorization header against the `CRON_SECRET` environment
 * variable. If authorized, reads cleanup configuration from environment variables, runs the cart cleanup
 * job (not a dry run), and returns the job result.
 *
 * @param request - Incoming request. Must include `Authorization: Bearer <CRON_SECRET>`.
 * @returns A NextResponse with JSON `{ ok: boolean, result?: object }` and HTTP status:
 *          `401` when unauthorized,
 *          `200` when cleanup completed without errors,
 *          `207` when there were errors but some deletions succeeded,
 *          `500` when cleanup failed completely or a fatal error occurred.
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