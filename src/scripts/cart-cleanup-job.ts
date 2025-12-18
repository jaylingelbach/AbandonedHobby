import { getPayload } from 'payload';
import type { Where } from 'payload';

import config from '@payload-config';

/**
 * Defines a cleanup rule for cart deletion.
 * @property {string} description - Human-readable description of what this rule targets
 * @property {Where} where - Payload query condition that identifies carts to delete
 */
export type CleanupRule = {
  description: string;
  where: Where;
};

export type CartCleanupOptions = {
  dryRun: boolean;

  guestAgeDays: number;
  emptyAgeDays?: number;
  archivedAgeDays?: number;

  batchSize: number;
  sleepMs: number;
  maxDelete?: number;
};

export type CartCleanupRuleResult = {
  description: string;
  matched: number;
  deleted: number;
  errorCount: number;
};

export type CartCleanupResult = {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  results: CartCleanupRuleResult[];
  totalMatched: number;
  totalDeleted: number;
  hadErrors: boolean;
};

type DeleteBatchOptions = {
  batchSize: number;
  sleepMs: number;
  maxDelete?: number;
};

type StopSignal = {
  shouldStop: () => boolean;
};

/**
 * Runs a cart cleanup job that removes carts matching configured rules and produces a summary of the run.
 *
 * The function validates the provided options, builds cleanup rules (guest carts and optionally empty/archived carts
 * based on age thresholds), counts matches per rule, and — unless `options.dryRun` is true — deletes matching carts
 * in batches. Per-rule errors are recorded and logged while allowing the job to continue for remaining rules.
 *
 * @param options - Configuration for the cleanup job (includes `dryRun`, age thresholds like `guestAgeDays`,
 *   optional `emptyAgeDays` and `archivedAgeDays`, and batching controls such as `batchSize`, `sleepMs`, and
 *   optional `maxDelete`).
 * @param stopSignal - Optional stop signal consulted between batches to allow a graceful, early shutdown.
 * @returns A `CartCleanupResult` containing `dryRun`, `startedAt` and `finishedAt` timestamps, an array of per-rule
 *   `results` (description, matched, deleted, errorCount), aggregated `totalMatched` and `totalDeleted`, and a
 *   boolean `hadErrors` indicating whether any rule failed.
export async function runCartCleanupJob(
  options: CartCleanupOptions,
  stopSignal?: StopSignal
): Promise<CartCleanupResult> {
  validateOptions(options);

  const startedAt = new Date().toISOString();
  const payload = await initPayload();

  const cleanupRules = buildCleanupRules(options);

  const results: CartCleanupRuleResult[] = [];
  let totalMatched = 0;
  let totalDeleted = 0;
  let hadErrors = false;

  for (const rule of cleanupRules) {
    try {
      const { totalDocs } = await payload.count({
        collection: 'carts',
        where: rule.where,
        overrideAccess: true
      });

      totalMatched += totalDocs;

      if (options.dryRun) {
        results.push({
          description: rule.description,
          matched: totalDocs,
          deleted: 0,
          errorCount: 0
        });
        continue;
      }

      if (totalDocs === 0) {
        results.push({
          description: rule.description,
          matched: 0,
          deleted: 0,
          errorCount: 0
        });
        continue;
      }

      const deletedCount = await deleteWhereInBatches(
        payload,
        rule.where,
        {
          batchSize: options.batchSize,
          sleepMs: options.sleepMs,
          maxDelete: options.maxDelete
        },
        stopSignal
      );

      results.push({
        description: rule.description,
        matched: totalDocs,
        deleted: deletedCount,
        errorCount: 0 // actual delete errors are logged in deleteWhereInBatches; keep result shape simple
      });

      totalDeleted += deletedCount;
    } catch (error: unknown) {
      hadErrors = true;
      results.push({
        description: rule.description,
        matched: 0,
        deleted: 0,
        errorCount: 1
      });

      console.error(
        `[cart-cleanup] ERROR while running rule "${rule.description}".`
      );
      logError(error);
      // Keep going so one bad rule doesn't prevent other cleanup.
    }
  }

  const finishedAt = new Date().toISOString();

  return {
    dryRun: options.dryRun,
    startedAt,
    finishedAt,
    results,
    totalMatched,
    totalDeleted,
    hadErrors
  };
}

/**
 * Build cleanup rules for cart deletion based on age thresholds.
 *
 * @param options - Configuration for which cleanup rules to generate.
 * @param options.guestAgeDays - Age in days for guest carts to target.
 * @param options.emptyAgeDays - If provided and greater than 0, include a rule for carts with zero items older than this many days.
 * @param options.archivedAgeDays - If provided and greater than 0, include a rule for carts with status `'archived'` older than this many days.
 * @returns An array of CleanupRule objects describing the cart selection criteria to apply during cleanup.
 */
export function buildCleanupRules(options: {
  guestAgeDays: number;
  emptyAgeDays?: number;
  archivedAgeDays?: number;
}): CleanupRule[] {
  const cleanupRules: CleanupRule[] = [
    {
      description: `guest carts older than ${options.guestAgeDays}d`,
      where: {
        and: [
          { buyer: { exists: false } },
          { guestSessionId: { exists: true } },
          { updatedAt: { less_than: daysAgoISO(options.guestAgeDays) } }
        ]
      }
    }
  ];

  if (typeof options.emptyAgeDays === 'number' && options.emptyAgeDays > 0) {
    cleanupRules.push({
      description: `empty carts older than ${options.emptyAgeDays}d`,
      where: {
        and: [
          { itemCount: { equals: 0 } },
          { updatedAt: { less_than: daysAgoISO(options.emptyAgeDays) } }
        ]
      }
    });
  }

  if (
    typeof options.archivedAgeDays === 'number' &&
    options.archivedAgeDays > 0
  ) {
    cleanupRules.push({
      description: `archived carts older than ${options.archivedAgeDays}d`,
      where: {
        and: [
          { status: { equals: 'archived' } },
          { updatedAt: { less_than: daysAgoISO(options.archivedAgeDays) } }
        ]
      }
    });
  }

  return cleanupRules;
}

/**
 * Initializes and returns a configured Payload instance.
 *
 * @returns The initialized Payload instance.
 * @throws The error encountered while initializing Payload (for example, config, environment, or database connection failure).
 */
async function initPayload() {
  try {
    return await getPayload({ config });
  } catch (error: unknown) {
    console.error(
      '[cart-cleanup] ERROR initializing Payload via getPayload().'
    );
    console.error(
      '[cart-cleanup] This usually means config/env/DB connection failed.'
    );
    logError(error);
    throw error;
  }
}

/**
 * Deletes matching cart documents in repeated batches until the query is exhausted, a stop signal or max-delete is reached, or no further progress can be made.
 *
 * @param payload - Initialized Payload instance used to query and delete cart documents.
 * @param where - Query used to select carts to delete.
 * @param options - Batch controls: `batchSize`, `sleepMs`, and optional `maxDelete` limit.
 * @param stopSignal - Optional graceful shutdown signal; when `shouldStop()` returns `true`, the function finishes and returns the current total.
 * @returns The total number of cart documents successfully deleted.
async function deleteWhereInBatches(
  payload: Awaited<ReturnType<typeof getPayload>>,
  where: Where,
  options: DeleteBatchOptions,
  stopSignal?: StopSignal
): Promise<number> {
  let deletedTotal = 0;
  let consecutiveZeroProgress = 0;
  const MAX_ZERO_PROGRESS_ATTEMPTS = 3;

  while (true) {
    if (stopSignal?.shouldStop() === true) {
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

    if (deletedThisBatch === 0) {
      consecutiveZeroProgress++;
      if (consecutiveZeroProgress >= MAX_ZERO_PROGRESS_ATTEMPTS) {
        console.error(
          `[cart-cleanup] No progress after ${MAX_ZERO_PROGRESS_ATTEMPTS} attempts. Stopping to prevent infinite loop. Total deleted: ${deletedTotal}.`
        );
        return deletedTotal;
      }
    } else {
      consecutiveZeroProgress = 0;
    }

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
 * Logs an error value to stderr, emitting an error stack if available.
 *
 * @param error - The value to log; if it's an `Error` the stack (or message) is written, otherwise the value is stringified and logged
 */
function logError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    return;
  }
  console.error(String(error));
}

/**
 * Retrieves the string `id` property from an object if present.
 *
 * @param value - The value to read an `id` property from
 * @returns The `id` string when present, `undefined` otherwise
 */
function extractId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const idValue = value.id;
  return typeof idValue === 'string' ? idValue : undefined;
}

/**
 * Type guard that determines whether a value is a non-null object.
 *
 * @returns `true` if `value` is a non-null object, `false` otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Pauses execution for the specified number of milliseconds.
 *
 * @param ms - The delay duration in milliseconds
 * @returns `void`
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Produce an ISO 8601 timestamp for the time that is `days` days before now.
 *
 * @param days - Number of days to subtract from the current time; may be fractional or negative to compute a future timestamp
 * @returns An ISO 8601 string representing the computed timestamp
 */
function daysAgoISO(days: number): string {
  const msInDay = 86_400_000;
  return new Date(Date.now() - days * msInDay).toISOString();
}

/**
 * Validates cleanup job configuration and throws if any numeric option is out of the accepted range.
 *
 * @param options - The CartCleanupOptions to validate (must include positive guestAgeDays, positive integer batchSize, non-negative integer sleepMs; optional numeric fields are validated if present).
 * @throws Error if `guestAgeDays` is not a positive number.
 * @throws Error if `emptyAgeDays` is provided and is not a positive integer.
 * @throws Error if `archivedAgeDays` is provided and is not a positive integer.
 * @throws Error if `batchSize` is not a positive integer.
 * @throws Error if `sleepMs` is not a non-negative integer.
 * @throws Error if `maxDelete` is provided and is not a positive integer.
 */
function validateOptions(options: CartCleanupOptions): void {
  if (!Number.isFinite(options.guestAgeDays) || options.guestAgeDays <= 0) {
    throw new Error('guestAgeDays must be a positive number.');
  }

  if (
    typeof options.emptyAgeDays === 'number' &&
    (!Number.isInteger(options.emptyAgeDays) || options.emptyAgeDays <= 0)
  ) {
    throw new Error('emptyAgeDays must be a positive integer when provided.');
  }
  if (
    typeof options.archivedAgeDays === 'number' &&
    (!Number.isInteger(options.archivedAgeDays) || options.archivedAgeDays <= 0)
  ) {
    throw new Error(
      'archivedAgeDays must be a positive integer when provided.'
    );
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
    throw new Error('batchSize must be a positive integer.');
  }
  if (!Number.isInteger(options.sleepMs) || options.sleepMs < 0) {
    throw new Error('sleepMs must be a non-negative integer.');
  }
  if (
    typeof options.maxDelete === 'number' &&
    (!Number.isInteger(options.maxDelete) || options.maxDelete <= 0)
  ) {
    throw new Error('maxDelete must be a positive integer when provided.');
  }
}