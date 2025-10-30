import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { getSellerOrdersData } from './seller-orders-utils';

/**
 * Renders the admin "Seller Orders" view including filtering controls, results table, and pager.
 *
 * @returns A React element containing the seller orders admin interface (toolbar, orders table or empty state, and pagination controls).
 */
export async function SellerOrders(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const localeCode =
    initPageResult.locale?.code?.replaceAll('_', '-') ?? 'en-US';

  const data = await getSellerOrdersData(props);
  const { items, page, totalPages } = data;

  // Helpers to build links with updated search params
  const makeHref = (updates: Record<string, string | number | undefined>) => {
    const url = new URL(
      `${initPageResult.req.payload.config.routes?.admin ?? '/admin'}/seller`,
      'http://localhost' // base ignored by Next when rendering href
    );
    // Carry forward current params
    const current = new URLSearchParams();
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (typeof value === 'string') {
          current.set(key, value);
        }
      }
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    }
    // Always target this view path; if you mount at a different path, adjust above
    url.pathname = `${
      initPageResult.req.payload.config.routes?.admin ?? '/admin'
    }/seller/orders`;
    url.search = current.toString();
    const search = url.search;
    return search ? `${url.pathname}?${search}` : url.pathname;
  };

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
        <div className="ah-seller-orders">
          <div className="mb-1">
            <h1 className="ah-dashboard-title">Orders</h1>
          </div>

          {/* Simple toolbar (server-rendered GET form) */}
          <form className="ah-toolbar" method="get">
            <input type="hidden" name="page" value="1" />
            <input
              className="input"
              name="q"
              defaultValue={
                typeof searchParams?.q === 'string' ? searchParams.q : ''
              }
              placeholder="Search by order # or buyer email"
              aria-label="Search orders"
            />
            <select
              className="input"
              name="hasTracking"
              defaultValue={
                searchParams?.hasTracking === 'yes' ||
                searchParams?.hasTracking === 'no'
                  ? searchParams.hasTracking
                  : ''
              }
              aria-label="Filter by tracking"
            >
              <option value="">All</option>
              <option value="yes">Has tracking</option>
              <option value="no">No tracking</option>
            </select>
            <select
              className="input"
              name="status"
              defaultValue={
                typeof searchParams?.status === 'string'
                  ? searchParams.status
                  : ''
              }
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="unfulfilled">Unfulfilled</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="returned">Returned</option>
            </select>
            <input
              className="input"
              type="date"
              name="from"
              defaultValue={
                typeof searchParams?.from === 'string' ? searchParams.from : ''
              }
              aria-label="From date"
            />
            <input
              className="input"
              type="date"
              name="to"
              defaultValue={
                typeof searchParams?.to === 'string' ? searchParams.to : ''
              }
              aria-label="To date"
            />
            <select
              className="input"
              name="sort"
              defaultValue={
                searchParams?.sort === 'createdAtAsc'
                  ? 'createdAtAsc'
                  : 'createdAtDesc'
              }
              aria-label="Sort"
            >
              <option value="createdAtDesc">Newest first</option>
              <option value="createdAtAsc">Oldest first</option>
            </select>
            <button className="btn" type="submit">
              Apply
            </button>
            <Link className="btn btn--ghost" href={makeHref({})}>
              Reset
            </Link>
          </form>

          {items.length === 0 ? (
            <p>No orders found.</p>
          ) : (
            <table className="ah-table" style={{ marginTop: 12 }}>
              <colgroup>
                <col className="ah-col--order" />
                <col className="ah-col--date" />
                <col className="ah-col--buyer" />
                <col className="ah-col--items" />
                <col className="ah-col--total" />
                <col className="ah-col--status" />
              </colgroup>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Buyer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>#{row.orderNumber ?? '—'}</td>
                    <td>
                      {new Date(row.createdAtISO).toLocaleDateString(
                        localeCode,
                        {
                          dateStyle: 'medium'
                        }
                      )}
                    </td>
                    <td>{row.buyerEmail ?? '—'}</td>
                    <td>{row.itemCount ?? 0}</td>
                    <td>
                      {formatCurrency(
                        (row.totalCents ?? 0) / 100,
                        row.currency ?? 'USD'
                      )}
                    </td>
                    <td>
                      <span className={`ah-badge ah-badge--${row.status}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pager */}
          <div className="ah-pager">
            {page <= 1 ? (
              <span className="btn btn--disabled">Prev</span>
            ) : (
              <Link className="btn" href={makeHref({ page: page - 1 })}>
                Prev
              </Link>
            )}
            <span className="ah-pager__page">
              Page {page} of {totalPages}
            </span>
            {page >= totalPages ? (
              <span className="btn btn--disabled">Next</span>
            ) : (
              <Link className="btn" href={makeHref({ page: page + 1 })}>
                Next
              </Link>
            )}
          </div>
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}

export default SellerOrders;
