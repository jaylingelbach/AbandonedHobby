import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';
import * as React from 'react';

import { getTenantIdsFromUser } from '@/lib/server/payload-utils/orders';

import { InlineTrackingForm } from '@/components/custom-payload/tracking/InlineTrackingForm';
import { UiCard } from '@/components/custom-payload/ui/UiCard';

import { getData } from './utils';

import type { AdminViewServerProps } from 'payload';
import { User } from '@/payload-types';

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
                  <th className="ah-col--order">Order</th>
                  <th className="ah-col--date">Date</th>
                  <th className="ah-col--total">Total</th>
                  <th className="ah-col--tracking">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {data.needsTracking.map((order) => (
                  <tr key={order.id}>
                    <td className="ah-col--order">#{order.orderNumber}</td>
                    <td className="ah-col--date">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="ah-col--total">
                      ${(order.totalCents / 100).toFixed(2)}
                    </td>
                    <td className="ah-col--tracking">
                      <div className="ah-tracking-cell">
                        <InlineTrackingForm
                          orderId={order.id}
                          initialCarrier="usps"
                          initialTracking=""
                          layout="stacked"
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
