import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';

import { InlineTrackingForm } from '@/components/custom-payload/tracking/InlineTrackingForm';
import { UiCard } from '@/components/custom-payload/ui/UiCard';
import { getData } from '../utils';

import type { AdminViewServerProps } from 'payload';
import { formatCurrency } from '@/lib/utils';
import { redirect } from 'next/navigation';

/**
 * Render the Seller Dashboard page that shows seller KPIs, quick actions, and orders requiring tracking.
 *
 * @param props - Server-side props and request context used to fetch dashboard data and resolve the current user and tenant IDs.
 * @returns A React element representing the Seller Dashboard UI, including an onboarding banner when Stripe setup is required, KPI cards, quick action links, and a table of orders awaiting tracking.
 */

export async function SellerDashboard(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  if (!initPageResult.req.user) {
    redirect(
      `/admin/login?redirect=${encodeURIComponent('/admin/seller/dashboard')}`
    );
  }
  let data;
  try {
    data = await getData(props);
  } catch (error) {
    console.log(error);
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
          <div className="ah-banner ah-banner-error" role="alert">
            <strong>Error:</strong> Unable to load dashboard data. Please try
            again later.
          </div>
        </Gutter>
      </DefaultTemplate>
    );
  }

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

          <UiCard title="Unsold">
            <h2 className="ah-kpi-value">{data.summary.unsold}</h2>
          </UiCard>

          <UiCard title="Quick Actions">
            <div className="ah-actions ah-actions--stacked">
              <Link
                prefetch={false}
                className="btn btn--block"
                href="/admin/collections/products/create"
              >
                List a Product
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
                href="/admin/seller/orders?status=unfulfilled"
              >
                View All Orders
              </Link>
            </div>
          </UiCard>
        </div>

        <section className="ah-section" aria-labelledby="ah-tracking-heading">
          <h2 id="ah-tracking-heading">Orders needing tracking</h2>

          {data.needsTracking.length === 0 ? (
            <p>All set—no orders awaiting tracking.</p>
          ) : (
            <table className="ah-table">
              <colgroup>
                <col className="ah-col--order" />
                <col className="ah-col--date" />
                <col className="ah-col--total" />
                <col className="ah-col--tracking" />
              </colgroup>
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
                        initPageResult.locale?.code?.replace('_', '-'),
                        { dateStyle: 'medium' }
                      )}
                    </td>
                    <td className="ah-col--total">
                      {formatCurrency(order.totalCents / 100)}
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
        <section className="ah-section" aria-labelledby="ah-shipped-heading">
          <h2 id="ah-shipped-heading">Recently shipped (tracking editable)</h2>

          {data.recentShipped.length === 0 ? (
            <p>No shipped orders in the last 30 days.</p>
          ) : (
            <table className="ah-table">
              <colgroup>
                <col className="ah-col--order" />
                <col className="ah-col--date" />
                <col className="ah-col--total" />
                <col className="ah-col--tracking" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="ah-col--order">
                    Order
                  </th>
                  <th scope="col" className="ah-col--date">
                    Shipped
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
                {data.recentShipped.map((order) => (
                  <tr key={order.orderId}>
                    <td className="ah-col--order">#{order.orderNumber}</td>
                    <td className="ah-col--date">
                      {new Date(order.shippedAtISO).toLocaleDateString(
                        initPageResult.locale?.code?.replace('_', '-'),
                        { dateStyle: 'medium' }
                      )}
                    </td>
                    <td className="ah-col--total">
                      {formatCurrency(
                        order.totalCents / 100,
                        order.currency ?? 'USD'
                      )}
                    </td>
                    <td className="ah-col--tracking">
                      <div className="ah-tracking-cell">
                        <InlineTrackingForm
                          orderId={order.orderId}
                          initialCarrier={order.carrier ?? 'other'}
                          initialTracking={order.trackingNumber ?? ''}
                          layout="inline"
                          // Optional: do not refresh the whole page if you want to keep
                          // the user’s scroll position – the row will still stay visible
                          // because it lives in the "shipped" section.
                          refreshOnSuccess={false}
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
