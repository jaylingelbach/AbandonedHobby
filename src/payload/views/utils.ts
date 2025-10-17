/**
 * This utils file is for the seller dashboard Data
 */

import type { AdminViewServerProps, Where } from 'payload';
import type { CountResult, CountSummary, OrderListItem } from './types';

/** Convert a Payload `count()` response to a plain number. */
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

/** Type guard for MinimalOrder. */
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

  const fulfillmentStatusIsValid =
    record.fulfillmentStatus === undefined ||
    record.fulfillmentStatus === null ||
    typeof record.fulfillmentStatus === 'string';

  return (
    totalIsValid &&
    orderNumberIsValid &&
    createdAtIsValid &&
    fulfillmentStatusIsValid
  );
}

/** Shape used for probe logging. */
type ProbeOrderFields = {
  id: string;
  sellerTenant: string | null;
  status: unknown;
  fulfillmentStatus: unknown;
  createdAt: unknown;
};

/** Safely extract probe fields from an unknown order object. */
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

/** Extract canonical tenant IDs (the relationship id), never array row ids. */
function getTenantIdsFromUser(user: unknown): string[] {
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

/**
 * Fetches summary counts and the list of unfulfilled orders visible to the seller.
 * Uses sellerTenant-only scoping.
 */
export async function getData(
  props: AdminViewServerProps
): Promise<{ summary: CountSummary; needsTracking: OrderListItem[] }> {
  const request = props.initPageResult.req;
  const payloadInstance = request.payload;

  const currentUser = request.user as
    | {
        id?: string;
        tenants?: Array<
          { id?: string } | { tenant?: string | { id?: string } }
        >;
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
      needsTracking: []
    };
  }

  const tenantIds = getTenantIdsFromUser(currentUser);
  const needsOnboarding = currentUser.stripeDetailsSubmitted === false;

  console.log('[seller-dashboard] tenant identifiers for user', {
    userId: currentUser.id,
    tenantIds
  });

  if (tenantIds.length === 0) {
    return {
      summary: { unfulfilledOrders: 0, lowInventory: 0, needsOnboarding },
      needsTracking: []
    };
  }

  const unfulfilledWhere = buildUnfulfilledWhere();

  // ---------- KPI: Unfulfilled count (scoped) ----------
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

  // ---------- Low inventory ----------
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

  // ---------- Unfulfilled list to act on ----------
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

  return {
    summary: {
      unfulfilledOrders: unfulfilledCount,
      lowInventory,
      needsOnboarding
    },
    needsTracking
  };
}
