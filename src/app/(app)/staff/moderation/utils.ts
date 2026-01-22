import { ModerationInboxItem, PageMeta } from './types';

/**
 * Extracts a numeric status code from an error-like value, if present.
 *
 * The function returns the value of a numeric `status` property when `error` is an object
 * that contains such a property; otherwise it returns `undefined`.
 *
 * @param error - The value to inspect for a `status` property
 * @returns The numeric `status` value if present, `undefined` otherwise
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  if ('status' in error) {
    const statusValue = (error as { status?: unknown }).status;
    if (typeof statusValue === 'number') {
      return statusValue;
    }
  }

  return undefined;
}

/**
 * Loads a moderation-related resource from the specified endpoint and returns its items.
 *
 * @param endpoint - The HTTP GET endpoint to request.
 * @param resourceName - Human-readable resource name used in error messages.
 * @returns An array of ModerationInboxItem parsed from the response JSON.
 * @throws Error when the request is unauthorized (401 or 403); the thrown error includes a numeric `status` property.
 * @throws Error when the response status is not OK (non-2xx).
 * @throws Error when the response JSON is not an array.
 */
async function fetchModerationResource(
  endpoint: string,
  resourceName: string
): Promise<ModerationInboxItem[]> {
  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include'
  });

  // Auth
  if (response.status === 401 || response.status === 403) {
    const error = new Error(
      `Not authorized to view ${resourceName}`
    ) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load ${resourceName}: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as unknown;

  // Minimal runtime guard so we don't blindly trust the shape
  if (!Array.isArray(json)) {
    throw new Error(`Unexpected ${resourceName} response shape`);
  }

  return json as ModerationInboxItem[];
}

/**
 * Load moderation inbox items from the server.
 *
 * Fetches the moderation inbox endpoint and returns the parsed items.
 *
 * @returns An array of `ModerationInboxItem` representing the moderation inbox entries.
 * @throws Error with a numeric `status` property set to 401 or 403 when the request is unauthorized or forbidden.
 * @throws Error when the response has a non-OK status (message includes status and statusText).
 * @throws Error when the response body is not an array as expected.
 */

export async function fetchModerationInbox(): Promise<ModerationInboxItem[]> {
  return fetchModerationResource('/api/inbox', 'moderation inbox');
}

/**
 * Load the removed moderation items from the server.
 *
 * @returns An array of `ModerationInboxItem` representing the removed items.
 * @throws Error with a numeric `status` property equal to `401` or `403` when the request is unauthorized or forbidden.
 * @throws Error when the response has a non-OK status (message includes status and statusText).
 * @throws Error when the response body is not an array as expected.
 */

export async function fetchRemovedItems(): Promise<ModerationInboxItem[]> {
  return fetchModerationResource('/api/removed', 'removed items');
}

/**
 * Normalize a requested page number into a sensible positive integer.
 *
 * If the input is not a finite number or is less than 1, this returns 1; otherwise it returns the input rounded down to the nearest integer.
 *
 * @param nextPage - The requested page number (may be non-integer or invalid)
 * @returns The page number clamped to an integer greater than or equal to 1
 */
export function clampPage(nextPage: number): number {
  if (!Number.isFinite(nextPage)) return 1;
  if (nextPage < 1) return 1;
  return Math.floor(nextPage);
}

/**
 * Produces a human-readable pagination range label for the current page.
 *
 * @param meta - Pagination metadata (page number, limit, totalDocs). If `null`, an empty string is returned.
 * @param itemsCount - Number of items on the current page; used to compute the end index.
 * @returns A label like "Showing 1–10 of 42", "Showing 0 of 0" when there are no items, or an empty string when `meta` is `null`.
 */
export function buildRangeLabel(
  meta: PageMeta | null,
  itemsCount: number
): string {
  if (!meta) return '';
  if (meta.totalDocs <= 0 || itemsCount <= 0) return 'Showing 0 of 0';

  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.totalDocs, start + itemsCount - 1);
  return `Showing ${start}–${end} of ${meta.totalDocs}`;
}