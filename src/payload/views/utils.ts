import type { AdminViewServerProps, Where } from 'payload';
import type { CountResult, CountSummary, OrderListItem } from './types';
import type { ShippedOrderListItem } from '@/modules/orders/types';

/* -----------------------------------------------------------------------------
 * Helpers used by the data loader
 * -------------------------------------------------------------------------- */

/**
 * Normalize a Payload `count()` response into a numeric count.
 *
 * @param result - The value returned by Payload's `count()` (a number or an object that may contain `totalDocs`) or any other value.
 * @returns The numeric count extracted from `result`, or `0` if a count cannot be determined.
 */
export function readCount(result: CountResult | unknown): number {
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

/** Minimal order projection used to build the needsTracking list. */
type MinimalOrder = {
  id: string;
  orderNumber?: string | null;
  total?: number | null; // cents
  createdAt?: string | null;
  fulfillmentStatus?: OrderListItem['fulfillmentStatus'] | null;
};

/**
 * Checks whether a value conforms to the MinimalOrder shape.
 *
 * @param value - The unknown value to test
 * @returns `true` if `value` matches the MinimalOrder shape, `false` otherwise
 */
function isMinimalOrder(value: unknown): value is MinimalOrder {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') return false;

  const totalIsValid =
    record.total === undefined ||
    record.total === null ||
    typeof record.total === 'number';

  const orderNumberIsValid =
    record.orderNumber === undefined ||
    record.orderNumber === null ||
    typeof record.orderNumber === 'string';

  const createdAtIsValid =
    record.createdAt === undefined ||
    record.createdAt === null ||
    typeof record.createdAt === 'string';

  return totalIsValid && orderNumberIsValid && createdAtIsValid;
}

/** Shape used for probe logging (no `any`). */
type ProbeOrderFields = {
  id: string;
  sellerTenant: string | null;
  status: unknown;
  fulfillmentStatus: unknown;
  createdAt: unknown;
};

/**
 * Extract a minimal set of diagnostic fields from an unknown order object.
 *
 * Attempts to read an `id` string from `value`; if missing or not a string, returns `null`.
 * When present, returns an object with `id`, `sellerTenant` (string or `null`), and the raw
 * `status`, `fulfillmentStatus`, and `createdAt` values as extracted from the input.
 *
 * @param value - The unknown value to inspect for order probe fields.
 * @returns A `ProbeOrderFields` object when `value` contains a string `id`, `null` otherwise.
 */
function extractProbeOrderFields(value: unknown): ProbeOrderFields | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  const idValue = record.id;
  if (typeof idValue !== 'string') return null;

  const sellerTenantRaw = record.sellerTenant;
  let sellerTenantId: string | null = null;
  if (typeof sellerTenantRaw === 'string') {
    sellerTenantId = sellerTenantRaw;
  } else if (
    typeof sellerTenantRaw === 'object' &&
    sellerTenantRaw !== null &&
    'id' in (sellerTenantRaw as { id?: unknown }) &&
    typeof (sellerTenantRaw as { id?: unknown }).id === 'string'
  ) {
    sellerTenantId = (sellerTenantRaw as { id: string }).id;
  }

  return {
    id: idValue,
    sellerTenant: sellerTenantId,
    status: record.status,
    fulfillmentStatus: record.fulfillmentStatus,
    createdAt: record.createdAt
  };
}

/**
 * Extracts canonical tenant IDs from a user object.
 *
 * Parses the user's tenants entries and returns an array of tenant relationship IDs.
 * Accepts entries where the tenant is either a string ID or an object with an `id` string.
 *
 * @param user - A user-shaped object that may contain a `tenants` array of tenant relations
 * @returns An array of tenant IDs (strings); entries without a usable ID are omitted
 */
export function getTenantIdsFromUser(user: unknown): string[] {
  type TenantRel = string | { id?: string | null };
  type UserWithTenants = { tenants?: Array<{ tenant?: TenantRel }> };

  const candidate = user as UserWithTenants | undefined;
  const tenantEntries = Array.isArray(candidate?.tenants)
    ? candidate!.tenants!
    : [];

  const tenantIds = tenantEntries
    .map((entry) => {
      const relation = entry?.tenant;
      if (typeof relation === 'string') return relation;
      if (
        relation &&
        typeof relation === 'object' &&
        typeof relation.id === 'string'
      ) {
        return relation.id;
      }
      return null;
    })
    .filter((id): id is string => typeof id === 'string');

  return tenantIds;
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

/** Filter used to fetch recently shipped orders. */
function buildShippedWhere(): Where {
  return {
    and: [
      { fulfillmentStatus: { equals: 'shipped' } },
      { 'shipment.shippedAt': { exists: true } }
    ]
  };
}

/* -----------------------------------------------------------------------------
 * Data loader used by the page
 * -------------------------------------------------------------------------- */

/**
 * Fetches seller-scoped KPI counts, orders needing tracking, and recently shipped orders.
 *
 * - “Needs tracking” = paid + unfulfilled.
 * - “Recently shipped” = shipped within the last 30 days (shippedAt present).
 */
export async function getData(props: AdminViewServerProps): Promise<{
  summary: CountSummary;
  needsTracking: OrderListItem[];
  recentShipped: ShippedOrderListItem[];
}> {
  const request = props.initPageResult.req;
  const payloadInstance = request.payload;

  const currentUser = request.user as
    | {
        id?: string;
        tenants?: Array<{ tenant?: string | { id?: string | null } }>;
        stripeDetailsSubmitted?: boolean;
      }
    | undefined;

  if (!currentUser) {
    return {
      summary: {
        unfulfilledOrders: 0,
        lowInventory: 0,
        needsOnboarding: false
      },
      needsTracking: [],
      recentShipped: []
    };
  }

  const tenantIds = getTenantIdsFromUser(currentUser);
  const needsOnboarding = currentUser.stripeDetailsSubmitted === false;

  // optional: log plugin row ids to avoid confusing them with relation ids
  const tenantArrayRowIds = Array.isArray(
    (currentUser as { tenants?: Array<{ id?: string }> })?.tenants
  )
    ? ((currentUser as { tenants?: Array<{ id?: string }> }).tenants || [])
        .map((tenantRow) => tenantRow.id)
        .filter((value): value is string => typeof value === 'string')
    : [];

  console.log('[seller-dashboard]', {
    userId: currentUser.id,
    tenantIds, // ✅ use these in queries
    tenantArrayRowIds // 🛠️ debug only
  });

  if (tenantIds.length === 0) {
    return {
      summary: { unfulfilledOrders: 0, lowInventory: 0, needsOnboarding },
      needsTracking: [],
      recentShipped: []
    };
  }

  const unfulfilledWhere = buildUnfulfilledWhere();

  // Probe (safe logs)
  try {
    const countSellerAnyStatus = await payloadInstance.count({
      collection: 'orders',
      where: { sellerTenant: { in: tenantIds } },
      overrideAccess: true
    });
    const countSellerPaidOnly = await payloadInstance.count({
      collection: 'orders',
      where: {
        and: [
          { sellerTenant: { in: tenantIds } },
          { status: { equals: 'paid' } }
        ]
      },
      overrideAccess: true
    });
    const countSellerPaidUnfulfilled = await payloadInstance.count({
      collection: 'orders',
      where: {
        and: [
          { sellerTenant: { in: tenantIds } },
          { status: { equals: 'paid' } },
          unfulfilledWhere
        ]
      },
      overrideAccess: true
    });

    console.log('[seller-dashboard probe]', {
      sellerTenant_anyStatus: readCount(countSellerAnyStatus),
      sellerTenant_paidOnly: readCount(countSellerPaidOnly),
      sellerTenant_paid_unfulfilled: readCount(countSellerPaidUnfulfilled)
    });

    const sampleOrders = await payloadInstance.find({
      collection: 'orders',
      depth: 0,
      limit: 5,
      sort: '-createdAt',
      where: {
        and: [
          { sellerTenant: { in: tenantIds } },
          { status: { not_in: ['canceled'] } }
        ]
      },
      overrideAccess: true
    });

    const sampleRows: ProbeOrderFields[] = sampleOrders.docs
      .map(extractProbeOrderFields)
      .filter((row): row is ProbeOrderFields => row !== null);

    console.log('[seller-dashboard probe sample]', sampleRows);
  } catch (probeError) {
    console.warn('[seller-dashboard probe] failed', probeError);
  }

  // KPI: unfulfilled count
  const scopedCountResponse = await payloadInstance.count({
    collection: 'orders',
    where: {
      and: [
        { sellerTenant: { in: tenantIds } },
        { status: { equals: 'paid' } },
        unfulfilledWhere
      ]
    }
  });
  const unfulfilledCount = readCount(scopedCountResponse);

  // Low inventory
  const lowInventoryResponse = await payloadInstance.count({
    collection: 'products',
    where: {
      and: [
        { tenant: { in: tenantIds } },
        { trackInventory: { equals: true } },
        { stockQuantity: { less_than_equal: 2 } },
        { isArchived: { not_equals: true } }
      ]
    }
  });
  const lowInventory = readCount(lowInventoryResponse);

  // Unfulfilled list
  const ordersResponse = await payloadInstance.find({
    collection: 'orders',
    depth: 0,
    pagination: true,
    limit: 25,
    sort: '-createdAt',
    where: {
      and: [
        { sellerTenant: { in: tenantIds } },
        { status: { equals: 'paid' } },
        unfulfilledWhere
      ]
    }
  });

  const needsTracking: OrderListItem[] = (ordersResponse.docs as unknown[])
    .filter(isMinimalOrder)
    .map((orderDocument) => {
      const totalCents =
        typeof orderDocument.total === 'number' ? orderDocument.total : 0;
      return {
        id: orderDocument.id,
        orderNumber: String(orderDocument.orderNumber ?? orderDocument.id),
        totalCents,
        createdAt: String(orderDocument.createdAt ?? new Date().toISOString()),
        fulfillmentStatus:
          (orderDocument.fulfillmentStatus as
            | OrderListItem['fulfillmentStatus']
            | null) ?? 'unfulfilled'
      };
    });

  // Recently shipped (last 30 days)
  const shippedSinceISO = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const shippedResponse = await payloadInstance.find({
    collection: 'orders',
    depth: 0,
    pagination: true,
    limit: 25,
    sort: '-shipment.shippedAt',
    where: {
      and: [
        { sellerTenant: { in: tenantIds } },
        { status: { not_equals: 'canceled' } },
        buildShippedWhere(),
        { 'shipment.shippedAt': { greater_than_equal: shippedSinceISO } }
      ]
    }
  });

  const recentShipped: ShippedOrderListItem[] = shippedResponse.docs.map(
    (orderDocument: unknown): ShippedOrderListItem => {
      const record = orderDocument as {
        id: string;
        orderNumber?: string | null;
        createdAt?: string | null;
        total?: number | null;
        shipment?: {
          carrier?: 'usps' | 'ups' | 'fedex' | 'other' | null;
          trackingNumber?: string | null;
          shippedAt?: string | null;
        } | null;
      };

      return {
        id: record.id,
        orderNumber: String(record.orderNumber ?? record.id),
        createdAtISO: String(record.createdAt ?? ''),
        shippedAtISO: String(record.shipment?.shippedAt ?? ''),
        totalCents: typeof record.total === 'number' ? record.total : 0,
        carrier: record.shipment?.carrier ?? undefined,
        trackingNumber: record.shipment?.trackingNumber ?? undefined
      };
    }
  );

  return {
    summary: {
      unfulfilledOrders: unfulfilledCount,
      lowInventory,
      needsOnboarding
    },
    needsTracking,
    recentShipped
  };
}
