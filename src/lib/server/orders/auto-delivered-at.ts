import type { CollectionBeforeChangeHook } from 'payload';

/**
 * If fulfillmentStatus transitions to "delivered", set deliveredAt (once).
 */
export const autoSetDeliveredAt: CollectionBeforeChangeHook = async ({
  data,
  originalDoc
}) => {
  if (!data) return data;

  const previousStatus =
    typeof originalDoc?.fulfillmentStatus === 'string'
      ? originalDoc.fulfillmentStatus
      : undefined;

  const nextStatus =
    typeof (data as { fulfillmentStatus?: unknown })?.fulfillmentStatus ===
    'string'
      ? (data as { fulfillmentStatus?: string }).fulfillmentStatus
      : previousStatus;

  if (previousStatus !== 'delivered' && nextStatus === 'delivered') {
    const hasDeliveredAt =
      typeof (data as { deliveredAt?: unknown })?.deliveredAt === 'string' &&
      (data as { deliveredAt?: string }).deliveredAt !== undefined &&
      (data as { deliveredAt?: string }).deliveredAt!.length > 0;

    if (!hasDeliveredAt) {
      return { ...data, deliveredAt: new Date().toISOString() };
    }
  }

  return data;
};
