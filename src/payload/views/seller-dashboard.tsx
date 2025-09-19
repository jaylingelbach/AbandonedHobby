import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import * as React from 'react';
import Link from 'next/link'; // <-- use Next Link for internal nav
import { UiCard } from '@/components/custom-payload/ui/UiCard';
import { InlineTrackingForm } from '@/components/custom-payload/tracking/InlineTrackingForm';

type CountSummary = {
  unfulfilledOrders: number;
  lowInventory: number;
  needsOnboarding: boolean;
};

type OrderListItem = {
  id: string;
  orderNumber: string;
  totalCents: number;
  createdAt: string;
  fulfillmentStatus: 'unfulfilled' | 'shipped' | 'delivered' | 'returned';
};

// small runtime helper so this works across Payload versions where count() returns a number vs an object
function readCount(result: unknown): number {
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

async function getData(
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
    ? user.tenants.map((t) => t.id)
    : [];

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

  // use the helper so ESLint stops complaining
  const lowInventory = readCount(lowInvRes);

  const needsOnboarding = user.stripeDetailsSubmitted === false;

  const needsTracking: OrderListItem[] = orders.docs.map((o: unknown) => {
    const doc = o as Partial<OrderListItem> & {
      id?: string;
      orderNumber?: string;
      totalCents?: number;
      total?: number; // your field is `total` (cents)
      createdAt?: string;
      fulfillmentStatus?: OrderListItem['fulfillmentStatus'];
    };
    const cents =
      typeof doc.totalCents === 'number'
        ? doc.totalCents
        : typeof doc.total === 'number'
          ? doc.total
          : 0;

    return {
      id: String(doc.id),
      orderNumber: String(doc.orderNumber),
      totalCents: cents,
      createdAt: String(doc.createdAt ?? new Date().toISOString()),
      fulfillmentStatus: (doc.fulfillmentStatus ??
        'unfulfilled') as OrderListItem['fulfillmentStatus']
    };
  });

  return {
    summary: {
      unfulfilledOrders: orders.totalDocs,
      lowInventory,
      needsOnboarding
    },
    needsTracking
  };
}

export async function SellerDashboard(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const data = await getData(props);

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div className="mb-1">
          <h1 className="ah-dashboard-title ">Seller Dashboard</h1>

          {data.summary.needsOnboarding && (
            <div className="ah-banner ah-banner-warning" role="alert">
              <strong>Action required:</strong> Complete Stripe onboarding to
              receive payouts.
            </div>
          )}
        </div>

        <div className="ah-grid ah-grid-3">
          <UiCard title="Unfulfilled Orders">
            <h2 className="ah-kpi-value">{data.summary.unfulfilledOrders}</h2>
          </UiCard>

          <UiCard title="Low Inventory">
            <h2 className="ah-kpi-value">{data.summary.lowInventory}</h2>
          </UiCard>

          <UiCard title="Quick Actions">
            <div className="ah-actions ah-actions--stacked">
              <Link
                className="btn btn--block"
                href="/admin/collections/products/create"
              >
                Add Product
              </Link>
              <Link
                className="btn btn--block"
                href="/admin/collections/products"
              >
                View Products
              </Link>
              <Link className="btn btn--block" href="/admin/collections/orders">
                View Orders
              </Link>
            </div>
          </UiCard>
        </div>

        <section
          className="ah-section"
          aria-labelledby="ah-tracking-heading"
          style={{ marginTop: 24 }}
        >
          <h2 id="ah-tracking-heading">Orders needing tracking</h2>
          {data.needsTracking.length === 0 ? (
            <p>All set—no orders awaiting tracking.</p>
          ) : (
            <table className="ah-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Tracking</th>
                </tr>
              </thead>
              <tbody>
                {data.needsTracking.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.orderNumber}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>${(o.totalCents / 100).toFixed(2)}</td>
                    <td>
                      <InlineTrackingForm
                        orderId={o.id}
                        initialCarrier="usps"
                        initialTracking=""
                        layout="stacked"
                        onSuccess={() => {
                          // optional: refresh or optimistically remove this row
                          // location.reload();
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </Gutter>
    </DefaultTemplate>
  );
}
