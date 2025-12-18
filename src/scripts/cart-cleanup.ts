import dotenv from 'dotenv';
import { runCartCleanupJob } from './cart-cleanup-job';

dotenv.config();

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

async function main(): Promise<void> {
  try {
    const result = await runCartCleanupJob(
      {
        dryRun,
        guestAgeDays,
        emptyAgeDays,
        archivedAgeDays,
        batchSize,
        sleepMs,
        maxDelete
      },
      { shouldStop: () => shuttingDown }
    );

    if (dryRun) {
      for (const row of result.results) {
        console.log(
          `[dry-run] ${row.description}: ${row.matched} carts would be deleted.`
        );
      }
    } else {
      for (const row of result.results) {
        console.log(
          `[cart-cleanup] ${row.description}: matched=${row.matched}, deleted=${row.deleted}, errors=${row.errorCount}`
        );
      }
    }

    if (result.hadErrors) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    process.exitCode = 1;
    console.error('[cart-cleanup] Fatal error. Exiting non-zero.');
    logError(error);
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
