import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import * as React from 'react';
import Link from 'next/link'; // <-- use Next Link for internal nav
import { UiCard } from '@/components/custom-payload/ui/UiCard';
import { InlineTrackingForm } from '@/components/custom-payload/tracking/InlineTrackingForm';
import { getData } from './utils';

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
