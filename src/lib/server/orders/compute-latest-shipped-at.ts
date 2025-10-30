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
 * Compute max(shipment.shippedAt, ...shipments[].shippedAt) as ISO string or undefined.
 * Runs after the mirror hooks so both shapes are in sync.
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
