import dotenv from 'dotenv';
import { getPayload } from 'payload';
import type { Where } from 'payload';

import config from '@payload-config';

dotenv.config();

type CleanupRule = {
  description: string;
  where: Where;
};

const args = process.argv.slice(2);

const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';

const guestAgeDays =
  parseDays('guest-age-days', process.env.GUEST_CART_MAX_AGE_DAYS, 30) ?? 30;
const emptyAgeDays = parseDays(
  'empty-age-days',
  process.env.EMPTY_CART_MAX_AGE_DAYS
);
const archivedAgeDays = parseDays(
  'archived-age-days',
  process.env.ARCHIVED_CART_MAX_AGE_DAYS
);

const batchSize =
  parsePositiveInt('batch-size', process.env.CLEANUP_BATCH_SIZE, 250) ?? 250;

const sleepMs = parseNonNegativeInt(
  'sleep-ms',
  process.env.CLEANUP_SLEEP_MS,
  0
);

const maxDelete = parsePositiveInt(
  'max-delete',
  process.env.CLEANUP_MAX_DELETE
);

if (guestAgeDays <= 0) {
  throw new Error('guest-age-days must be a positive number of days.');
}
if (batchSize <= 0) {
  throw new Error('batch-size must be a positive integer.');
}

let shuttingDown = false;
process.on('SIGINT', () => {
  console.warn('[cart-cleanup] Received SIGINT (Ctrl+C). Exiting…');
  process.exitCode = 130; // standard “terminated by Ctrl+C”
  shuttingDown = true;
});

await main();

async function main(): Promise<void> {
  const payload = await initPayload();

  const cleanupRules: CleanupRule[] = [
    {
      description: `guest carts older than ${guestAgeDays}d`,
      where: {
        and: [
          { buyer: { exists: false } },
          { guestSessionId: { exists: true } },
          { updatedAt: { less_than: daysAgoISO(guestAgeDays) } }
        ]
      }
    }
  ];

  if (typeof emptyAgeDays === 'number' && emptyAgeDays > 0) {
    cleanupRules.push({
      description: `empty carts older than ${emptyAgeDays}d`,
      where: {
        and: [
          { itemCount: { less_than_equal: 0 } },
          { updatedAt: { less_than: daysAgoISO(emptyAgeDays) } }
        ]
      }
    });
  }

  if (typeof archivedAgeDays === 'number' && archivedAgeDays > 0) {
    cleanupRules.push({
      description: `archived carts older than ${archivedAgeDays}d`,
      where: {
        and: [
          { status: { equals: 'archived' } },
          { updatedAt: { less_than: daysAgoISO(archivedAgeDays) } }
        ]
      }
    });
  }

  for (const rule of cleanupRules) {
    try {
      await runCleanup(payload, rule);
    } catch (error: unknown) {
      process.exitCode = 1;
      console.error(
        `[cart-cleanup] ERROR while running rule "${rule.description}".`
      );
      logError(error);
      // Keep going so one bad rule doesn’t prevent other cleanup.
    }
  }
}

async function initPayload() {
  try {
    return await getPayload({ config });
  } catch (error: unknown) {
    process.exitCode = 1;
    console.error(
      '[cart-cleanup] ERROR initializing Payload via getPayload().'
    );
    console.error(
      '[cart-cleanup] This usually means config/env/DB connection failed.'
    );
    logError(error);

    // Throw to stop main() early; the top-level await will end the process.
    throw error;
  }
}

async function runCleanup(
  payload: Awaited<ReturnType<typeof getPayload>>,
  rule: CleanupRule
): Promise<void> {
  const { totalDocs } = await payload.count({
    collection: 'carts',
    where: rule.where,
    overrideAccess: true
  });

  if (dryRun) {
    console.log(
      `[dry-run] ${rule.description}: ${totalDocs} carts would be deleted.`
    );
    return;
  }

  if (totalDocs === 0) {
    console.log(`No carts matched for ${rule.description}.`);
    return;
  }

  console.log(
    `Starting cleanup: ${rule.description} (estimated ${totalDocs} carts). ` +
      `Batch size: ${batchSize}${sleepMs ? `, sleep: ${sleepMs}ms` : ''}${
        typeof maxDelete === 'number' ? `, max-delete: ${maxDelete}` : ''
      }.`
  );

  const deletedCount = await deleteWhereInBatches(payload, rule.where, {
    batchSize,
    sleepMs,
    maxDelete
  });

  console.log(
    `Finished: deleted ${deletedCount} carts for ${rule.description}.`
  );
}

async function deleteWhereInBatches(
  payload: Awaited<ReturnType<typeof getPayload>>,
  where: Where,
  options: { batchSize: number; sleepMs: number; maxDelete?: number }
): Promise<number> {
  let deletedTotal = 0;

  while (true) {
    if (shuttingDown) {
      console.warn(
        `[cart-cleanup] Shutdown requested. Stopping after ${deletedTotal} deletions.`
      );
      return deletedTotal;
    }
    if (
      typeof options.maxDelete === 'number' &&
      deletedTotal >= options.maxDelete
    ) {
      console.warn(
        `Reached max-delete=${options.maxDelete}. Stopping early (deleted ${deletedTotal}).`
      );
      return deletedTotal;
    }

    const remainingBudget =
      typeof options.maxDelete === 'number'
        ? Math.max(0, options.maxDelete - deletedTotal)
        : options.batchSize;

    const limit = Math.min(options.batchSize, remainingBudget);
    if (limit <= 0) return deletedTotal;

    const result = await payload.find({
      collection: 'carts',
      where,
      limit,
      page: 1,
      depth: 0,
      overrideAccess: true,
      sort: 'updatedAt'
    });

    const docsUnknown: unknown = result.docs;
    const docs = Array.isArray(docsUnknown) ? docsUnknown : [];

    const ids = docs
      .map((doc) => extractId(doc))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (ids.length === 0) return deletedTotal;

    const deleteRes = await payload.delete({
      collection: 'carts',
      where: { id: { in: ids } },
      overrideAccess: true,
      depth: 0
    });

    const deletedThisBatch = Array.isArray(
      (deleteRes as { docs?: unknown }).docs
    )
      ? ((deleteRes as { docs: unknown[] }).docs.length ?? 0)
      : 0;

    deletedTotal += deletedThisBatch;

    const errorsUnknown = (deleteRes as { errors?: unknown }).errors;
    const errorCount = Array.isArray(errorsUnknown) ? errorsUnknown.length : 0;

    console.log(
      `Batch deleted ${deletedThisBatch}/${ids.length}. Total deleted: ${deletedTotal}${
        errorCount ? ` (errors: ${errorCount})` : ''
      }.`
    );

    if (errorCount) {
      console.error('[cart-cleanup] Delete errors:', errorsUnknown);
    }

    if (options.sleepMs > 0) {
      await sleep(options.sleepMs);
    }
  }
}

function logError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    return;
  }
  console.error(String(error));
}

function extractId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const idValue = value.id;
  return typeof idValue === 'string' ? idValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function daysAgoISO(days: number): string {
  const msInDay = 86_400_000;
  return new Date(Date.now() - days * msInDay).toISOString();
}

function parseDays(
  flagName: string,
  envValue?: string,
  fallback?: number
): number | undefined {
  const raw = readArg(flagName) ?? envValue;
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number provided for ${flagName}: ${String(raw)}`);
  }
  return parsed;
}

function parsePositiveInt(
  flagName: string,
  envValue?: string,
  fallback?: number
): number | undefined {
  const raw = readArg(flagName) ?? envValue;
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${flagName}: ${String(raw)}`);
  }
  return parsed;
}

function parseNonNegativeInt(
  flagName: string,
  envValue?: string,
  fallback?: number
): number {
  const raw = readArg(flagName) ?? envValue;
  if (raw === undefined || raw === '') return fallback ?? 0;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid non-negative integer for ${flagName}: ${String(raw)}`
    );
  }
  return parsed;
}

function readArg(name: string): string | undefined {
  const withEquals = `--${name}=`;
  const direct = args.find((arg) => arg.startsWith(withEquals));
  if (direct) return direct.slice(withEquals.length);

  const index = args.indexOf(`--${name}`);
  if (index !== -1) {
    const nextArg = args[index + 1];
    if (nextArg !== undefined && !nextArg.startsWith('--')) {
      return nextArg;
    }
  }

  return undefined;
}
