// src/payload/views/buyer-dashboard-utils.ts
import type { AdminViewServerProps, Where } from 'payload';

export type BuyerCountSummary = {
  awaitingShipment: number;
  inTransit: number;
};

export type BuyerOrderListItem = {
  id: string;
  orderNumber: string;
  totalCents: number;
  createdAtISO: string;
  fulfillmentStatus: 'unfulfilled' | 'shipped' | 'delivered' | 'returned';
  carrier?: 'usps' | 'ups' | 'fedex' | 'other';
  trackingNumber?: string;
  shippedAtISO?: string;
};

type CountResult = number | { totalDocs?: number };

/* -----------------------------------------------------------------------------
 * Shared helpers
 * -------------------------------------------------------------------------- */

/** Normalize a Payload `count()` response into a number. */
function readCount(result: CountResult | unknown): number {
  if (typeof result === 'number') return result;
  if (
    typeof result === 'object' &&
    result !== null &&
    'totalDocs' in result &&
    typeof (result as { totalDocs?: unknown }).totalDocs === 'number'
  ) {
    return (result as { totalDocs: number }).totalDocs;
  }
  return 0;
}

/** Treat missing/empty fulfillmentStatus as “unfulfilled”. */
function buildUnfulfilledWhere(): Where {
  return {
    or: [
      { fulfillmentStatus: { equals: 'unfulfilled' } },
      { fulfillmentStatus: { exists: false } },
      { fulfillmentStatus: { equals: null } },
      { fulfillmentStatus: { equals: '' } }
    ]
  };
}

/** Shipped = fulfillmentStatus: shipped AND a shippedAt timestamp present (legacy single shipment). */
function buildShippedWhereSingle(): Where {
  return {
    and: [
      { fulfillmentStatus: { equals: 'shipped' } },
      { 'shipment.shippedAt': { exists: true } }
    ]
  };
}

/** Also consider orders with shipments[] entries that have shippedAt. */
function buildShippedWhereArray(): Where {
  // Payload supports querying array fields with dot paths.
  // We only need to verify at least one shipments[].shippedAt exists.
  return {
    and: [
      { fulfillmentStatus: { equals: 'shipped' } },
      { 'shipments.shippedAt': { exists: true } }
    ]
  };
}

/** Scope orders to a specific buyer ID. */
function buildBuyerScopeWhere(userId: string): Where {
  return { buyer: { equals: userId } };
}

/**
 * Pick the “best” shipment info from either the legacy single `shipment` group
 * or the newer `shipments[]` array. We prefer the most recent shippedAt.
 */
function pickShipmentFromRecord(record: {
  shipment?: {
    carrier?: unknown;
    trackingNumber?: unknown;
    shippedAt?: unknown;
  } | null;
  shipments?: Array<{
    carrier?: unknown;
    trackingNumber?: unknown;
    shippedAt?: unknown;
  }> | null;
}): {
  carrier?: 'usps' | 'ups' | 'fedex' | 'other';
  trackingNumber?: string;
  shippedAtISO?: string;
} {
  let chosenCarrier: 'usps' | 'ups' | 'fedex' | 'other' | undefined;
  let chosenTrackingNumber: string | undefined;
  let chosenShippedAt: string | undefined;

  // Consider legacy single shipment
  const single = record.shipment;
  if (
    single &&
    typeof single.shippedAt === 'string' &&
    single.shippedAt.length > 0
  ) {
    const carrierCandidate =
      single.carrier === 'usps' ||
      single.carrier === 'ups' ||
      single.carrier === 'fedex' ||
      single.carrier === 'other'
        ? single.carrier
        : undefined;

    const trackingCandidate =
      typeof single.trackingNumber === 'string'
        ? single.trackingNumber
        : undefined;

    chosenCarrier = carrierCandidate ?? chosenCarrier;
    chosenTrackingNumber = trackingCandidate ?? chosenTrackingNumber;
    chosenShippedAt = single.shippedAt;
  }

  // Consider array shipments; pick the most recent shippedAt
  const arrayShipments = Array.isArray(record.shipments)
    ? record.shipments
    : [];

  for (const shipment of arrayShipments) {
    if (
      typeof shipment?.shippedAt !== 'string' ||
      shipment.shippedAt.length === 0
    ) {
      continue;
    }
    const carrierCandidate =
      shipment.carrier === 'usps' ||
      shipment.carrier === 'ups' ||
      shipment.carrier === 'fedex' ||
      shipment.carrier === 'other'
        ? shipment.carrier
        : undefined;

    const trackingCandidate =
      typeof shipment.trackingNumber === 'string'
        ? shipment.trackingNumber
        : undefined;

    // If we do not have a chosen date yet, or this one is more recent, take it
    if (!chosenShippedAt || shipment.shippedAt > chosenShippedAt) {
      chosenCarrier = carrierCandidate;
      chosenTrackingNumber = trackingCandidate;
      chosenShippedAt = shipment.shippedAt;
    }
  }

  return {
    carrier: chosenCarrier,
    trackingNumber: chosenTrackingNumber,
    shippedAtISO: chosenShippedAt
  };
}

/** Minimal guard to read list items from unknown order docs. */
function toBuyerOrderListItem(value: unknown): BuyerOrderListItem | null {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as {
    id?: unknown;
    orderNumber?: unknown;
    total?: unknown;
    createdAt?: unknown;
    fulfillmentStatus?: unknown;
    shipment?: {
      carrier?: unknown;
      trackingNumber?: unknown;
      shippedAt?: unknown;
    } | null;
    shipments?: Array<{
      carrier?: unknown;
      trackingNumber?: unknown;
      shippedAt?: unknown;
    }> | null;
  };

  if (typeof record.id !== 'string') return null;

  const orderNumber =
    typeof record.orderNumber === 'string' ? record.orderNumber : record.id;

  const totalCents = typeof record.total === 'number' ? record.total : 0;

  const createdAtISO =
    typeof record.createdAt === 'string'
      ? record.createdAt
      : new Date().toISOString();

  const fulfillmentStatusRaw = record.fulfillmentStatus;
  const fulfillmentStatus =
    fulfillmentStatusRaw === 'shipped' ||
    fulfillmentStatusRaw === 'delivered' ||
    fulfillmentStatusRaw === 'returned'
      ? fulfillmentStatusRaw
      : 'unfulfilled';

  const chosen = pickShipmentFromRecord(record);

  return {
    id: record.id,
    orderNumber,
    totalCents,
    createdAtISO,
    fulfillmentStatus,
    carrier: chosen.carrier,
    trackingNumber: chosen.trackingNumber,
    shippedAtISO: chosen.shippedAtISO
  };
}

/* -----------------------------------------------------------------------------
 * Loader used by the Buyer Dashboard
 * -------------------------------------------------------------------------- */

export async function getBuyerData(props: AdminViewServerProps): Promise<{
  summary: BuyerCountSummary;
  awaitingShipment: BuyerOrderListItem[];
  inTransit: BuyerOrderListItem[];
}> {
  const request = props.initPageResult.req;
  const payloadInstance = request.payload;

  const currentUser = request.user as { id?: string } | undefined;
  const userId = typeof currentUser?.id === 'string' ? currentUser.id : null;

  if (!userId) {
    return {
      summary: { awaitingShipment: 0, inTransit: 0 },
      awaitingShipment: [],
      inTransit: []
    };
  }

  const buyerScope = buildBuyerScopeWhere(userId);
  const unfulfilledWhere = buildUnfulfilledWhere();

  // KPI: awaiting shipment (paid + unfulfilled)
  const awaitingShipmentCountResponse = await payloadInstance.count({
    collection: 'orders',
    where: {
      and: [{ status: { equals: 'paid' } }, unfulfilledWhere, buyerScope]
    },
    overrideAccess: true // optional: match your seller loader style if used
  });
  const awaitingShipmentCount = readCount(awaitingShipmentCountResponse);

  // KPI: in transit (shipped) - cover both legacy `shipment` and `shipments[]`
  const inTransitCountResponse = await payloadInstance.count({
    collection: 'orders',
    where: {
      and: [
        {
          or: [buildShippedWhereSingle(), buildShippedWhereArray()]
        },
        buyerScope
      ]
    },
    overrideAccess: true
  });
  const inTransitCount = readCount(inTransitCountResponse);

  // Awaiting shipment list
  const awaitingShipmentResponse = await payloadInstance.find({
    collection: 'orders',
    depth: 0,
    pagination: true,
    limit: 25,
    sort: '-createdAt',
    where: {
      and: [{ status: { equals: 'paid' } }, unfulfilledWhere, buyerScope]
    },
    overrideAccess: true
  });

  const awaitingShipment: BuyerOrderListItem[] = (
    awaitingShipmentResponse.docs as unknown[]
  )
    .map(toBuyerOrderListItem)
    .filter((item): item is BuyerOrderListItem => item !== null);

  // In transit list (recent first by shippedAt – use the legacy path for sorting;
  // if only shipments[] exists, order will still be "recent-ish" due to payload default sort)
  const inTransitResponse = await payloadInstance.find({
    collection: 'orders',
    depth: 0,
    pagination: true,
    limit: 25,
    sort: '-shipment.shippedAt',
    where: {
      and: [
        {
          or: [buildShippedWhereSingle(), buildShippedWhereArray()]
        },
        buyerScope
      ]
    },
    overrideAccess: true
  });

  const inTransit: BuyerOrderListItem[] = (inTransitResponse.docs as unknown[])
    .map(toBuyerOrderListItem)
    .filter((item): item is BuyerOrderListItem => item !== null);

  return {
    summary: {
      awaitingShipment: awaitingShipmentCount,
      inTransit: inTransitCount
    },
    awaitingShipment,
    inTransit
  };
}
