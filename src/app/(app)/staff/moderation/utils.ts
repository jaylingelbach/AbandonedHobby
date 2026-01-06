import { ModerationInboxItem } from './types';

/** Helper: read a numeric `status` off any thrown error safely */
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

/** Fetcher used by React Query */
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
    throw new Error('Failed to load moderation inbox');
  }

  const json = (await response.json()) as unknown;

  // Minimal runtime guard so we don't blindly trust the shape
  if (!Array.isArray(json)) {
    throw new Error('Unexpected moderation inbox response shape');
  }

  return json as ModerationInboxItem[];
}
