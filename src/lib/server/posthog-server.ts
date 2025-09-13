import { PostHog } from 'posthog-node';

const apiKey =
  process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const posthogServer: PostHog | null = apiKey
  ? new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1
    })
  : null;
