/**
 * Formats an ISO timestamp as a human-friendly relative time (e.g., "yesterday", "2 hours ago").
 *
 * Accepts an ISO-compatible date string and returns a localized relative time using Intl.RelativeTimeFormat.
 * Handles past and future times, choosing the largest appropriate unit (years → seconds) and falling back
 * to seconds if no larger unit applies.
 *
 * @param iso - ISO 8601 date/time string (or any string accepted by `new Date(...)`).
 * @returns A localized relative time string (e.g., "in 3 days", "5 minutes ago", "yesterday").
 */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', (1000 * 60 * 60 * 24 * 365) / 12],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000]
  ];
  for (const [unit, div] of units) {
    if (Math.abs(ms) >= div || unit === 'second') {
      return rtf.format(Math.round(ms / div) * -1, unit);
    }
  }
  return '';
}
