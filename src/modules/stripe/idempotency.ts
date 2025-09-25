import { isUniqueViolation } from '@/app/(app)/api/stripe/webhooks/utils/utils';
import { Payload } from 'payload';

export async function hasProcessed(payload: Payload, eventId: string) {
  const res = await payload.find({
    collection: 'stripe_events',
    where: { eventId: { equals: eventId } },
    limit: 1,
    depth: 0,
    overrideAccess: true
  });
  return res.totalDocs > 0;
}

export async function markProcessed(payload: Payload, eventId: string) {
  try {
    await payload.create({
      collection: 'stripe_events',
      data: { eventId },
      overrideAccess: true
    });
  } catch (err: any) {
    if (!isUniqueViolation(err)) throw err;
  }
}
