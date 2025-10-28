import type { Payload } from 'payload';
import { pickCanonicalShipment } from './pick-canonical-shipment';

type AnyRecord = Record<string, unknown>;

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
