import type { PayloadRequest } from 'payload';

type ShipmentLike = {
  shippedAt?: unknown;
};

type DataShape = {
  shipment?: ShipmentLike | null;
  shipments?: Array<ShipmentLike | null> | null;
  latestShippedAt?: unknown;
};

/**
 * Compute the most recent `shippedAt` timestamp from either a legacy `shipment` or `shipments[]`
 * and set it on the provided data as an ISO string in `latestShippedAt`.
 *
 * @param args - Function arguments
 * @param args.data - Input data object containing either `shipment` (with `shippedAt`) or `shipments` array; this object is updated and returned
 * @returns The updated data object with `latestShippedAt` set to the ISO string of the latest valid `shippedAt`, or `undefined` if no valid timestamps were found
 */
export async function computeLatestShippedAt(args: {
  data?: unknown;
  originalDoc?: unknown;
  req: PayloadRequest;
}) {
  const next: DataShape = (args.data ?? {}) as DataShape;

  const candidates: string[] = [];

  // Legacy single shipment
  const single = next.shipment;
  if (single && typeof single.shippedAt === 'string' && single.shippedAt) {
    candidates.push(single.shippedAt);
  }

  // Array shipments
  if (Array.isArray(next.shipments)) {
    for (const entry of next.shipments) {
      const ts = entry?.shippedAt;
      if (typeof ts === 'string' && ts) candidates.push(ts);
    }
  }

  // Compute max valid timestamp
  const parsed = candidates
    .map((iso) => Date.parse(iso))
    .filter((n) => Number.isFinite(n));

  if (parsed.length > 0) {
    const maxTs = Math.max(...parsed);
    next.latestShippedAt = new Date(maxTs).toISOString();
  } else {
    next.latestShippedAt = undefined;
  }

  return next;
}