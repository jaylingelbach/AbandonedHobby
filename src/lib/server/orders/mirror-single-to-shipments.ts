import type { CollectionBeforeChangeHook } from 'payload';
import type { ShipmentGroup } from '@/lib/orders/types';

/**
 * Determines whether a shipment group contains any meaningful shipment information.
 *
 * @param group - The shipment group to inspect (may be undefined)
 * @returns `true` if `carrier`, `trackingNumber`, `trackingUrl`, or `shippedAt` is present, `false` otherwise
 */
function hasAnyShipmentValue(group: ShipmentGroup | undefined): boolean {
  if (!group) return false;
  return Boolean(
    group.carrier ||
      group.trackingNumber ||
      group.trackingUrl ||
      group.shippedAt
  );
}

/**
 * During transition, if a single `shipment` group is provided but `shipments[]`
 * is empty, seed `shipments[]` with that one entry.
 */
export const mirrorSingleShipmentToArray: CollectionBeforeChangeHook = async ({
  data,
  originalDoc
}) => {
  const next = (data ?? {}) as {
    shipment?: ShipmentGroup;
    shipments?: Array<ShipmentGroup>;
  };

  const prev = (originalDoc ?? {}) as {
    shipment?: ShipmentGroup;
    shipments?: Array<ShipmentGroup>;
  };

  // If shipments[] already exists with at least one entry (incoming or existing), do nothing.
  const alreadyHasArray =
    (Array.isArray(next.shipments) && next.shipments.length > 0) ||
    (Array.isArray(prev.shipments) && prev.shipments.length > 0);

  if (alreadyHasArray) return data;

  // Prefer the incoming shipment; fall back to the previous doc
  const group: ShipmentGroup | undefined =
    next.shipment ?? prev.shipment ?? undefined;

  if (!hasAnyShipmentValue(group)) return data;

  // At this point, group must be defined because hasAnyShipmentValue returned true
  return {
    ...next,
    shipments: [
      {
        carrier: group!.carrier,
        trackingNumber: group!.trackingNumber,
        trackingUrl: group!.trackingUrl,
        shippedAt: group!.shippedAt
      }
    ]
  };
};
