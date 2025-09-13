import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.posthog.com';

if (!POSTHOG_KEY && process.env.NODE_ENV === 'production') {
  console.warn(
    '[Analytics] PostHog key not configured - analytics will be disabled'
  );
}

export const ph = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST })
  : null;

export type ProductListedProps = {
  productId: string;
  price?: number;
  currency?: string; // if you only sell in USD, just set 'USD'
  tenantSlug?: string;
};

export async function captureProductListed(
  distinctId: string,
  props: ProductListedProps,
  groups?: { tenant?: string }
): Promise<void> {
  if (!ph) return;
  ph.capture({
    event: 'productListed',
    distinctId,
    properties: props,
    groups
    // Optional dedupe: uuid: `productListed:${props.productId}`,
  });

  // In serverless environments, always flush to avoid event drops
  // Check for common serverless indicators
  const isServerless =
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.NODE_ENV !== 'production';
  if (isServerless) {
    await ph.flush();
  }
}
