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

if (guestAgeDays <= 0) {
  throw new Error('guest-age-days must be a positive number of days.');
}

const payload = await getPayload({ config });

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
  await runCleanup(rule);
}

async function runCleanup(rule: CleanupRule): Promise<void> {
  if (dryRun) {
    const { totalDocs } = await payload.count({
      collection: 'carts',
      where: rule.where,
      overrideAccess: true
    });
    console.log(
      `[dry-run] ${rule.description}: ${totalDocs} carts would be deleted.`
    );
    return;
  }

  const res = await payload.delete({
    collection: 'carts',
    where: rule.where,
    overrideAccess: true,
    depth: 0
  });

  const docs = res.docs;
  const errors = res.errors;

  console.log(`Deleted ${docs.length} ${rule.description}.`);

  if (errors.length > 0) {
    console.error(
      `${errors.length} errors while deleting ${rule.description}:`,
      errors
    );
  }
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
  const flag = readArg(flagName);
  const raw = flag ?? envValue;
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number provided for ${flagName}: ${String(raw)}`);
  }
  return parsed;
}

function readArg(name: string): string | undefined {
  const withEquals = `--${name}=`;
  const direct = args.find((arg) => arg.startsWith(withEquals));
  if (direct) return direct.slice(withEquals.length);

  const index = args.indexOf(`--${name}`);
  if (index !== -1) return args[index + 1];

  return undefined;
}
