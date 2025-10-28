import type { Payload } from 'payload';
import { pickCanonicalShipment } from './pick-canonical-shipment';

type AnyRecord = Record<string, unknown>;

/**
 * Ensures the `shipment` field mirrors a canonical shipment selected from the incoming `shipment` or `shipments` data.
 *
 * @param data - The incoming update object; may be returned unchanged if falsy or no canonical shipment is found
 * @param originalDoc - The existing document used to compute the merged shape before selecting the canonical shipment
 * @returns The `data` object with its `shipment` field updated to include `carrier`, `trackingNumber`, `trackingUrl`, and `shippedAt` from the chosen canonical shipment, or the original `data` unchanged if no canonical shipment is available
 */
export async function mirrorShipmentsArrayToSingle({
  data,
  originalDoc
}: {
  data?: AnyRecord;
  originalDoc?: AnyRecord;
  req: { payload: Payload };
  operation: 'create' | 'update' | 'delete';
}) {
  if (!data) return data;

  // Compose what the doc will look like after this change
  const nextShape = { ...(originalDoc ?? {}), ...data } as {
    shipment?: unknown;
    shipments?: unknown;
  };

  const chosen = pickCanonicalShipment({
    shipment: nextShape.shipment as unknown as {
      carrier?: 'usps' | 'ups' | 'fedex' | 'other';
      trackingNumber?: string;
      trackingUrl?: string;
      shippedAt?: string;
    } | null,
    shipments: nextShape.shipments as unknown as Array<{
      carrier?: 'usps' | 'ups' | 'fedex' | 'other';
      trackingNumber?: string;
      trackingUrl?: string;
      shippedAt?: string;
    }> | null
  });

  if (!chosen) return data;

  // Mirror the chosen entry into `shipment` (canonical)
  return {
    ...data,
    shipment: {
      ...(typeof data.shipment === 'object' && data.shipment !== null
        ? (data.shipment as AnyRecord)
        : {}),
      carrier: chosen.carrier,
      trackingNumber: chosen.trackingNumber,
      trackingUrl: chosen.trackingUrl,
      shippedAt: chosen.shippedAt
    }
  };
}