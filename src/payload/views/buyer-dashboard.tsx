import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';
import type { AdminViewServerProps } from 'payload';
import { getBuyerData } from './buyer-dashboard-utils';

/**
 * Format a numeric dollar amount into a localized currency string.
 *
 * @param amountInDollars - The monetary amount in dollars to format.
 * @param currency - ISO 4217 currency code to use for formatting (defaults to `USD`).
 * @returns The formatted currency string (for example, `"$1,234.56"`).
 */
function formatCurrencyDisplay(
  amountInDollars: number,
  currency = 'USD'
): string {
  const numeric = amountInDollars;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(numeric);
}

/**
 * Extracts a `currency` string from an arbitrary value if present.
 *
 * @param value - The value to inspect for a `currency` property.
 * @param fallback - The currency to return when a valid `currency` string is not found (defaults to `USD`).
 * @returns The `currency` string found on `value`, or the provided `fallback`.
 */
function readCurrencyFromOrder(
  value: unknown,
  fallback: string = 'USD'
): string {
  if (
    value !== null &&
    typeof value === 'object' &&
    'currency' in value &&
    typeof (value as { currency?: unknown }).currency === 'string'
  ) {
    return (value as { currency: string }).currency;
  }
  return fallback;
}

/**
 * Renders the buyer dashboard view showing shipment summaries, awaiting and in-transit orders, and quick action links.
 *
 * @param props - Server rendering props required to build the admin buyer dashboard (locale, request, permissions, params, and search parameters)
 * @returns A JSX element representing the buyer dashboard UI
 */
export async function BuyerDashboard(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const data = await getBuyerData(props);

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
          <h1 className="ah-dashboard-title">Buyer Dashboard</h1>
        </div>

        <div className="ah-grid ah-grid-3">
          <div className="ah-card">
            <div className="ah-card-header">
              <h3 className="ah-card-title">Awaiting Shipment</h3>
            </div>
            <div className="ah-card-body">
              <h2 className="ah-kpi-value">{data.summary.awaitingShipment}</h2>
            </div>
          </div>

          <div className="ah-card">
            <div className="ah-card-header">
              <h3 className="ah-card-title">In Transit</h3>
            </div>
            <div className="ah-card-body">
              <h2 className="ah-kpi-value">{data.summary.inTransit}</h2>
            </div>
          </div>

          <div className="ah-card">
            <div className="ah-card-header">
              <h3 className="ah-card-title">Quick Actions</h3>
            </div>
            <div className="ah-card-body">
              <div className="ah-actions ah-actions--stacked">
                <Link
                  prefetch={false}
                  className="btn btn--block"
                  href="/admin/collections/orders"
                >
                  View All Orders
                </Link>
                <Link
                  prefetch={false}
                  className="btn btn--block"
                  href="/admin/collections/products"
                >
                  Browse Products
                </Link>
              </div>
            </div>
          </div>
        </div>

        <section
          className="ah-section"
          aria-labelledby="ah-awaiting-heading"
          style={{ marginTop: 24 }}
        >
          <h2 id="ah-awaiting-heading">Awaiting shipment</h2>
          {data.awaitingShipment.length === 0 ? (
            <p>No orders are awaiting shipment.</p>
          ) : (
            <table className="ah-table">
              <colgroup>
                <col className="ah-col--order" />
                <col className="ah-col--date" />
                <col className="ah-col--total" />
                <col className="ah-col--actions" />
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
                  <th scope="col" className="ah-col--actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.awaitingShipment.map((order) => (
                  <tr key={order.id}>
                    <td className="ah-col--order">#{order.orderNumber}</td>
                    <td className="ah-col--date">
                      {new Date(order.createdAtISO).toLocaleDateString(
                        initPageResult.locale?.code?.replace('_', '-'),
                        { dateStyle: 'medium' }
                      )}
                    </td>
                    <td className="ah-col--total">
                      {formatCurrencyDisplay(
                        order.totalCents / 100,
                        readCurrencyFromOrder(order, 'USD')
                      )}
                    </td>
                    <td className="ah-col--actions">
                      <Link
                        prefetch={false}
                        className="btn btn--sm"
                        href={`/admin/collections/orders/${order.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          className="ah-section"
          aria-labelledby="ah-transit-heading"
          style={{ marginTop: 24 }}
        >
          <h2 id="ah-transit-heading">In transit</h2>
          {data.inTransit.length === 0 ? (
            <p>No shipments are currently in transit.</p>
          ) : (
            <table className="ah-table">
              <colgroup>
                <col className="ah-col--order" />
                <col className="ah-col--date" />
                <col className="ah-col--total" />
                <col className="ah-col--tracking" />
                <col className="ah-col--actions" />
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
                  <th scope="col" className="ah-col--actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.inTransit.map((order) => (
                  <tr key={order.id}>
                    <td className="ah-col--order">#{order.orderNumber}</td>
                    <td className="ah-col--date">
                      {order.shippedAtISO
                        ? new Date(order.shippedAtISO).toLocaleDateString(
                            initPageResult.locale?.code?.replace('_', '-'),
                            { dateStyle: 'medium' }
                          )
                        : '—'}
                    </td>
                    <td className="ah-col--total">
                      {formatCurrencyDisplay(
                        order.totalCents / 100,
                        readCurrencyFromOrder(order, 'USD')
                      )}
                    </td>
                    <td className="ah-col--tracking">
                      {order.trackingNumber ? (
                        <span>
                          {order.carrier
                            ? `${order.carrier.toUpperCase()}: `
                            : ''}
                          {order.trackingNumber}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="ah-col--actions">
                      <Link
                        prefetch={false}
                        className="btn btn--sm"
                        href={`/admin/collections/orders/${order.id}`}
                      >
                        View
                      </Link>
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

export default BuyerDashboard;