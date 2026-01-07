import { ModerationInboxItem } from './types';

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
  const response = await fetch('/api/inbox', {
    method: 'GET',
    credentials: 'include'
  });

  // Auth / authz handling
  if (response.status === 401 || response.status === 403) {
    const error = new Error(
      'Not authorized to view moderation inbox'
    ) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load moderation inbox: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as unknown;

  // Minimal runtime guard so we don't blindly trust the shape
  if (!Array.isArray(json)) {
    throw new Error('Unexpected moderation inbox response shape');
  }

  return json as ModerationInboxItem[];
}