import type { Carrier } from '@/constants';

export type ShipmentEntry = {
  carrier?: Carrier;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string; // ISO
};

export type OrderLike = {
  shipment?: ShipmentEntry | null;
  shipments?: ShipmentEntry[] | null;
};

/**
 * Pick the best shipment to mirror into `shipment`.
 * Strategy: prefer the entry with the most recent `shippedAt` across both sources.
 * Falls back to the legacy `shipment` if it has a `shippedAt`.
 */
export function pickCanonicalShipment(
  doc: OrderLike | null | undefined
): ShipmentEntry | undefined {
  if (!doc) return undefined;

  let best: ShipmentEntry | undefined =
    doc.shipment?.shippedAt && typeof doc.shipment.shippedAt === 'string'
      ? { ...doc.shipment }
      : undefined;

  const list = Array.isArray(doc.shipments) ? doc.shipments : [];
  for (const s of list) {
    if (!s || typeof s.shippedAt !== 'string' || s.shippedAt.length === 0)
      continue;
    if (!best || s.shippedAt > (best.shippedAt ?? '')) best = { ...s };
  }

  if (!best) return undefined;
  if (!(best.trackingNumber || best.carrier || best.shippedAt))
    return undefined;
  return best;
}
