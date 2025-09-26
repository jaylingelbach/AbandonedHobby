import { ExistingOrderPrecheck } from '@/app/(app)/api/stripe/webhooks/utils/types';
import type { Payload } from 'payload';

export async function findExistingOrderBySessionOrEvent(
  payload: Payload,
  sessionId: string,
  eventId: string
): Promise<ExistingOrderPrecheck | null> {
  const res = await payload.find({
    collection: 'orders',
    where: {
      or: [
        { stripeCheckoutSessionId: { equals: sessionId } },
        { stripeEventId: { equals: eventId } }
      ]
    },
    limit: 1,
    depth: 0,
    overrideAccess: true
  });
  if (res.totalDocs === 0) return null;

  const doc = res.docs[0] as unknown as {
    id?: unknown;
    items?: ExistingOrderPrecheck['items'];
    inventoryAdjustedAt?: string | null;
  };

  return {
    id: String(doc.id),
    items: Array.isArray(doc.items) ? doc.items : [],
    inventoryAdjustedAt: doc.inventoryAdjustedAt ?? null
  };
}
