import type { CollectionBeforeChangeHook } from 'payload';
import { computeOrderAmounts } from './compute-amounts';

/**
 * Always recompute `amounts` server-side.
 * Ignores any client-sent `amounts` to prevent tampering.
 * Allows webhooks/system to pass through known fees via req.context if desired.
 */
export const lockAndCalculateAmounts: CollectionBeforeChangeHook = async ({
  data,
  originalDoc
}) => {
  if (!data) return data;

  // Source totals: prefer incoming `data.total`, else previous doc
  const totalCents =
    typeof data.total === 'number'
      ? data.total
      : typeof originalDoc?.total === 'number'
        ? originalDoc.total
        : 0;

  // Optional: if your webhook writes these into data already, they’ll be picked up below
  const shippingTotalCents = (
    data as { amounts?: { shippingTotalCents?: number } }
  )?.amounts?.shippingTotalCents;
  const discountTotalCents = (
    data as { amounts?: { discountTotalCents?: number } }
  )?.amounts?.discountTotalCents;
  const stripeFeeCents = (data as { amounts?: { stripeFeeCents?: number } })
    ?.amounts?.stripeFeeCents;
  const platformFeeCents = (data as { amounts?: { platformFeeCents?: number } })
    ?.amounts?.platformFeeCents;

  const computed = computeOrderAmounts({
    items: (data as { items?: unknown })?.items ?? originalDoc?.items ?? [],
    totalCents,
    shippingTotalCents,
    discountTotalCents,
    stripeFeeCents,
    platformFeeCents
  });

  return {
    ...data,
    amounts: computed
  };
};
