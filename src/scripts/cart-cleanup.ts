import dotenv from 'dotenv';
import { getPayload } from 'payload';
import type { Where } from 'payload';

import config from '@payload-config';

dotenv.config();

/**
 * Defines a cleanup rule for cart deletion.
 * @property {string} description - Human-readable description of what this rule targets
 * @property {Where} where - Payload query condition that identifies carts to delete
 */
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
  process.exitCode = 130; // standard "terminated by Ctrl+C"
  shuttingDown = true;
});

await main();

/**
 * Main entry point for the cart cleanup script.
 * Initializes Payload, builds cleanup rules based on configuration, and executes
 * cleanup for each rule. Handles errors gracefully and continues processing
 * remaining rules if one fails.
 * @returns {Promise<void>}
 */
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
      // Keep going so one bad rule doesn't prevent other cleanup.
    }
  }
}

/**
 * Initializes and returns a Payload instance.
 * @returns {Promise<Awaited<ReturnType<typeof getPayload>>>} Configured Payload instance
 * @throws {Error} If Payload initialization fails (config/env/DB connection issues)
 */
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

/**
 * Executes a single cleanup rule against the carts collection.
 * In dry-run mode, counts and logs how many carts would be deleted.
 * In normal mode, deletes matching carts in batches and logs progress.
 * @param {Awaited<ReturnType<typeof getPayload>>} payload - Payload instance
 * @param {CleanupRule} rule - The cleanup rule to execute
 * @returns {Promise<void>}
 */
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

/**
 * Deletes carts matching the given query in batches.
 * Processes deletions iteratively, respecting batch size, max delete limit,
 * and sleep intervals. Handles graceful shutdown on SIGINT.
 * @param {Awaited<ReturnType<typeof getPayload>>} payload - Payload instance
 * @param {Where} where - Query condition to identify carts to delete
 * @param {Object} options - Deletion configuration options
 * @param {number} options.batchSize - Number of carts to delete per batch
 * @param {number} options.sleepMs - Milliseconds to sleep between batches
 * @param {number} [options.maxDelete] - Maximum total deletions allowed (optional)
 * @returns {Promise<number>} Total number of carts deleted
 */
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

/**
 * Logs an error to the console. If the error is an Error instance,
 * logs its stack trace or message. Otherwise, converts it to a string.
 * @param {unknown} error - The error to log
 * @returns {void}
 */
function logError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    return;
  }
  console.error(String(error));
}

/**
 * Safely extracts the `id` field from an unknown value.
 * @param {unknown} value - Value to extract ID from
 * @returns {string | undefined} The ID if present and valid, otherwise undefined
 */
function extractId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const idValue = value.id;
  return typeof idValue === 'string' ? idValue : undefined;
}

/**
 * Type guard to check if a value is a non-null object.
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a record (object with string keys)
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns a promise that resolves after the specified delay.
 * @param {number} ms - Number of milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates an ISO timestamp for a date N days ago from now.
 * @param {number} days - Number of days to subtract from current time
 * @returns {string} ISO 8601 formatted timestamp string
 */
function daysAgoISO(days: number): string {
  const msInDay = 86_400_000;
  return new Date(Date.now() - days * msInDay).toISOString();
}

/**
 * Parses a number of days from CLI arguments or environment variables.
 * @param {string} flagName - Name of the CLI flag (without -- prefix)
 * @param {string} [envValue] - Optional environment variable value
 * @param {number} [fallback] - Default value if not provided
 * @returns {number | undefined} Parsed number of days, fallback, or undefined
 * @throws {Error} If the provided value is not a valid number
 */
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

/**
 * Parses a positive integer from CLI arguments or environment variables.
 * @param {string} flagName - Name of the CLI flag (without -- prefix)
 * @param {string} [envValue] - Optional environment variable value
 * @param {number} [fallback] - Default value if not provided
 * @returns {number | undefined} Parsed positive integer, fallback, or undefined
 * @throws {Error} If the provided value is not a valid positive integer
 */
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

/**
 * Parses a non-negative integer from CLI arguments or environment variables.
 * @param {string} flagName - Name of the CLI flag (without -- prefix)
 * @param {string} [envValue] - Optional environment variable value
 * @param {number} [fallback] - Default value if not provided (defaults to 0)
 * @returns {number} Parsed non-negative integer or fallback
 * @throws {Error} If the provided value is not a valid non-negative integer
 */
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

/**
 * Reads a command-line argument value by flag name.
 * Supports both `--name=value` and `--name value` formats.
 * @param {string} name - Flag name to search for (without -- prefix)
 * @returns {string | undefined} The argument value if found, otherwise undefined
 */
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
