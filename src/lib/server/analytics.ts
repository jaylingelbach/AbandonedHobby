import { posthogServer } from '@/lib/server/posthog-server';

export const flushIfNeeded = async () => {
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.NETLIFY;
  if (isServerless || process.env.NODE_ENV !== 'production') {
    await posthogServer?.flush?.();
  }
};
