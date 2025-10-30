import type { AdminViewServerProps, Where } from 'payload';
import type { Carrier } from '@/constants';
import type { BuyerDashboardCountSummary, BuyerOrderListItem } from '../types';

/* -----------------------------------------------------------------------------
 * Shared helpers
 * -------------------------------------------------------------------------- */

/**
 * Convert a raw Payload `count()` result into a safe numeric count.
 *
 * @param result - The raw value returned by a Payload `count()` call
 * @returns The numeric count from `result`, or `0` if `result` is not a number
 */
function readCount(result: unknown): number {
  return typeof result === 'number' ? result : 0;
}

/**
 * Produce a Where clause that matches records whose fulfillmentStatus should be treated as unfulfilled.
 *
 * @returns A Where clause matching documents where `fulfillmentStatus` is `'unfulfilled'`, does not exist, is `null`, or is an empty string.
 */
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

/**
 * Creates a Where clause matching legacy single-shipment orders that are marked shipped and have a `shipment.shippedAt` timestamp.
 *
 * @returns A `Where` clause that matches documents with `fulfillmentStatus` equal to `'shipped'` and a present `shipment.shippedAt` field.
 */
function buildShippedWhereSingle(): Where {
  return {
    and: [
      { fulfillmentStatus: { equals: 'shipped' } },
      { 'shipment.shippedAt': { exists: true } }
    ]
  };
}

/**
 * Builds a WHERE clause that matches orders whose fulfillmentStatus is "shipped" and that have at least one `shipments[].shippedAt`.
 *
 * @returns A `Where` clause targeting orders with `fulfillmentStatus: 'shipped'` and an existing `shipments.shippedAt` field
 */
function buildShippedWhereArray(): Where {
  return {
    and: [
      { fulfillmentStatus: { equals: 'shipped' } },
      { 'shipments.shippedAt': { exists: true } }
    ]
  };
}

/** Scope orders to a specific buyer ID. */
export function buildBuyerScopeWhere(userId: string): Where {
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
  carrier?: Carrier;
  trackingNumber?: string;
  shippedAtISO?: string;
} {
  let chosenCarrier: Carrier | undefined;
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
        ? (single.carrier as Carrier)
        : undefined;

    const trackingCandidate =
      typeof single.trackingNumber === 'string'
        ? single.trackingNumber
        : undefined;

    chosenCarrier = carrierCandidate;
    chosenTrackingNumber = trackingCandidate;
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
        ? (shipment.carrier as Carrier)
        : undefined;

    const trackingCandidate =
      typeof shipment.trackingNumber === 'string'
        ? shipment.trackingNumber
        : undefined;

    const nextTs = Date.parse(String(shipment.shippedAt));
    const chosenTs = chosenShippedAt ? Date.parse(chosenShippedAt) : -1;
    if (!Number.isNaN(nextTs) && nextTs > chosenTs) {
      chosenCarrier = carrierCandidate;
      chosenTrackingNumber = trackingCandidate;
      chosenShippedAt = String(shipment.shippedAt);
    }
  }

  return {
    carrier: chosenCarrier,
    trackingNumber: chosenTrackingNumber,
    shippedAtISO: chosenShippedAt
  };
}

/**
 * Normalize an unknown order document into a BuyerOrderListItem or return null if it cannot be normalized.
 *
 * Validates that `value` is an object with a string `id` and a non-empty `createdAt`. Produces a BuyerOrderListItem containing:
 * - `id`
 * - `orderNumber` (uses `orderNumber` if present and a string, otherwise falls back to `id`)
 * - `totalCents` (uses numeric `total`, otherwise `0`)
 * - `createdAtISO`
 * - `fulfillmentStatus` (one of `'shipped'`, `'delivered'`, `'returned'`; defaults to `'unfulfilled'`)
 * - shipment fields `carrier`, `trackingNumber`, and `shippedAtISO` when available
 *
 * @returns A BuyerOrderListItem populated from `value`, or `null` if required fields are missing or invalid.
 */
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
    typeof record.createdAt === 'string' ? record.createdAt : '';
  if (!createdAtISO) return null;

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

/**
 * Load buyer-specific dashboard summary and lists for the current user.
 *
 * @param props - Server-side view props containing the request and Payload instance
 * @returns An object with:
 *  - `summary`: counts for `awaitingShipment` and `inTransit`
 *  - `awaitingShipment`: up to 25 normalized `BuyerOrderListItem` documents awaiting shipment (sorted newest first)
 *  - `inTransit`: up to 25 normalized `BuyerOrderListItem` documents that are shipped, sorted by shipped date (most recent first) or `createdAt` when shipped date is unavailable
 */

export async function getBuyerData(props: AdminViewServerProps): Promise<{
  summary: BuyerDashboardCountSummary;
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

  // NOTE: We intentionally do NOT use overrideAccess here so that collection-level
  // access control (scoping to the buyer) is enforced.
  // If Orders access is not yet implemented, either add it or keep buyerScope in `where`.
  // KPI: awaiting shipment (paid + unfulfilled)
  const awaitingShipmentCountResponse = await payloadInstance.count({
    collection: 'orders',
    where: {
      and: [{ status: { equals: 'paid' } }, unfulfilledWhere, buyerScope]
    }
  });
  const awaitingShipmentCount = readCount(awaitingShipmentCountResponse);

  // KPI: in transit (shipped) — cover both legacy `shipment` and `shipments[]`
  const inTransitCountResponse = await payloadInstance.count({
    collection: 'orders',
    where: {
      and: [
        { fulfillmentStatus: { equals: 'shipped' } },
        { latestShippedAt: { exists: true } },
        buyerScope
      ]
    }
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
    }
  });

  const awaitingShipment: BuyerOrderListItem[] = (
    awaitingShipmentResponse.docs as unknown[]
  )
    .map(toBuyerOrderListItem)
    .filter((item): item is BuyerOrderListItem => item !== null);

  // In transit list (fetch more than you need, then slice after sort)
  const pageSize = 25;

  // Over-fetch to ensure we have enough valid records after sorting
  const inTransitResponse = await payloadInstance.find({
    collection: 'orders',
    depth: 0,
    pagination: true,
    limit: pageSize * 2,
    sort: '-latestShippedAt',
    where: {
      and: [
        { fulfillmentStatus: { equals: 'shipped' } },
        { latestShippedAt: { exists: true } },
        buyerScope
      ]
    }
  });

  const inTransit: BuyerOrderListItem[] = (inTransitResponse.docs as unknown[])
    .map(toBuyerOrderListItem)
    .filter((item): item is BuyerOrderListItem => item !== null)
    .sort((a, b) => {
      // Prefer shippedAtISO; fall back to createdAtISO
      const bt = Date.parse(b.shippedAtISO ?? b.createdAtISO);
      const at = Date.parse(a.shippedAtISO ?? a.createdAtISO);

      // Invalid -> push to end
      const bInvalid = Number.isNaN(bt);
      const aInvalid = Number.isNaN(at);
      if (bInvalid && aInvalid) {
        // Stable tiebreakers: createdAtISO, then orderNumber, then id
        const bCreated = Date.parse(b.createdAtISO);
        const aCreated = Date.parse(a.createdAtISO);
        if (!Number.isNaN(bCreated) && !Number.isNaN(aCreated)) {
          if (bCreated !== aCreated) return bCreated - aCreated;
        }
        if (a.orderNumber !== b.orderNumber) {
          return a.orderNumber < b.orderNumber ? 1 : -1;
        }
        return a.id < b.id ? 1 : -1;
      }
      if (bInvalid) return 1;
      if (aInvalid) return -1;

      if (bt !== at) return bt - at;

      // Stable tiebreakers when shipped timestamps equal
      const bCreated = Date.parse(b.createdAtISO);
      const aCreated = Date.parse(a.createdAtISO);
      if (
        !Number.isNaN(bCreated) &&
        !Number.isNaN(aCreated) &&
        bCreated !== aCreated
      ) {
        return bCreated - aCreated;
      }
      if (a.orderNumber !== b.orderNumber) {
        return a.orderNumber < b.orderNumber ? 1 : -1;
      }
      return a.id < b.id ? 1 : -1;
    })
    .slice(0, pageSize); // now take the first page deterministically

  return {
    summary: {
      awaitingShipment: awaitingShipmentCount,
      inTransit: inTransitCount
    },
    awaitingShipment,
    inTransit
  };
}
