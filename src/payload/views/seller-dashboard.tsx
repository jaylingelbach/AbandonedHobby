import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';

import { getTenantIdsFromUser } from '@/lib/server/payload-utils/orders';
import { InlineTrackingForm } from '@/components/custom-payload/tracking/InlineTrackingForm';
import { UiCard } from '@/components/custom-payload/ui/UiCard';
import { getData } from './utils';

import type { AdminViewServerProps } from 'payload';
import { User } from '@/payload-types';
import { formatCurrency } from '@/lib/utils';

/**
 * Renders the Seller Dashboard page, displaying seller KPIs, quick actions, and orders that need tracking.
 *
 * @param props - Server-side props and request context used to fetch dashboard data and user/tenant information.
 * @returns The dashboard UI containing: an onboarding banner when Stripe setup is required, KPI cards for unfulfilled orders and low inventory, quick action links, and a table of orders awaiting tracking (each row includes an inline tracking form).
 */

export async function SellerDashboard(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const data = await getData(props);

  const tenantIds = getTenantIdsFromUser(initPageResult.req.user);
  const user = initPageResult.req.user as User | undefined;
  const rowIds = Array.isArray(user?.tenants)
    ? user.tenants.map((tenant) => tenant?.id).filter(Boolean)
    : [];

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
          <h1 className="ah-dashboard-title">Seller Dashboard</h1>

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
                prefetch={false}
                className="btn btn--block"
                href="/admin/collections/products/create"
              >
                Add Product
              </Link>
              <Link
                prefetch={false}
                className="btn btn--block"
                href="/admin/collections/products"
              >
                View Products
              </Link>
              <Link
                prefetch={false}
                className="btn btn--block"
                href="/admin/collections/orders"
              >
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
                  <th scope="col" className="ah-col--order">
                    Order
                  </th>
                  <th scope="col" className="ah-col--date">
                    Date
                  </th>
                  <th scope="col" className="ah-col--total">
                    Total
                  </th>
                  <th scope="col" className="ah-col--tracking">
                    Tracking
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.needsTracking.map((order) => (
                  <tr key={order.id}>
                    <td className="ah-col--order">#{order.orderNumber}</td>
                    <td className="ah-col--date">
                      {new Date(order.createdAt).toLocaleDateString(
                        initPageResult.locale?.code
                      )}
                    </td>
                    <td className="ah-col--total">
                      {formatCurrency((order.totalCents / 100).toFixed(2))}
                    </td>
                    <td className="ah-col--tracking">
                      <div className="ah-tracking-cell">
                        <InlineTrackingForm
                          orderId={order.id}
                          initialCarrier="usps"
                          initialTracking=""
                          layout="inline"
                        />
                      </div>
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
