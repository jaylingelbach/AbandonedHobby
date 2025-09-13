import { posthogServer } from '@/lib/server/posthog-server';

export const ph = posthogServer;

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
