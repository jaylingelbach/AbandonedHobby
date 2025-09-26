import { AdminViewServerProps } from 'payload';

import { CountResult, CountSummary, OrderListItem } from './types';

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

export async function getData(
  props: AdminViewServerProps
): Promise<{ summary: CountSummary; needsTracking: OrderListItem[] }> {
  const {
    initPageResult: { req }
  } = props;

  const { payload } = req;

  const user = req.user as
    | { tenants?: Array<{ id: string }>; stripeDetailsSubmitted?: boolean }
    | undefined;

  if (!user) {
    return {
      summary: {
        unfulfilledOrders: 0,
        lowInventory: 0,
        needsOnboarding: false
      },
      needsTracking: []
    };
  }

  const tenantIds = Array.isArray(user.tenants)
    ? user.tenants.map((tenant) => tenant.id)
    : [];

  if (tenantIds.length === 0) {
    return {
      summary: {
        unfulfilledOrders: 0,
        lowInventory: 0,
        needsOnboarding: user.stripeDetailsSubmitted === false
      },
      needsTracking: []
    };
  }

  // 1) Unfulfilled, PAID orders for this seller's tenant(s)
  const orders = await payload.find({
    collection: 'orders',
    depth: 0,
    pagination: false,
    where: {
      and: [
        { sellerTenant: { in: tenantIds } },
        { status: { equals: 'paid' } },
        { fulfillmentStatus: { equals: 'unfulfilled' } }
      ]
    }
  });

  // 2) Low inventory products for the same tenant(s)
  const lowInvRes = await payload.count({
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

  // normalize cross-version payload.count() return (number vs { totalDocs })
  const lowInventory = readCount(lowInvRes);

  const needsOnboarding = user.stripeDetailsSubmitted === false;

  const needsTracking: OrderListItem[] = orders.docs.flatMap(
    (order: unknown) => {
      const doc = order as Partial<OrderListItem> & {
        id?: string;
        orderNumber?: string;
        totalCents?: number;
        total?: number; // your field is `total` (cents)
        createdAt?: string;
        fulfillmentStatus?: OrderListItem['fulfillmentStatus'];
      };
      if (!doc?.id) return [];
      const cents =
        typeof doc.totalCents === 'number'
          ? doc.totalCents
          : typeof doc.total === 'number'
            ? doc.total
            : 0;

      return [
        {
          id: String(doc.id),
          orderNumber: String(doc.orderNumber ?? doc.id),
          totalCents: cents,
          createdAt: String(doc.createdAt ?? new Date().toISOString()),
          fulfillmentStatus: (doc.fulfillmentStatus ??
            'unfulfilled') as OrderListItem['fulfillmentStatus']
        }
      ];
    }
  );

  return {
    summary: {
      unfulfilledOrders: orders.totalDocs,
      lowInventory,
      needsOnboarding
    },
    needsTracking
  };
}
