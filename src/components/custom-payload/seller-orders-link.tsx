// src/components/custom-payload/seller-orders-link.tsx
import { NavGroup } from '@payloadcms/ui';
import type { ServerProps } from 'payload';

/**
 * Render a navigation group labeled "Seller" containing a link to the seller orders admin page.
 *
 * @param payload - Server-side props object whose configuration's admin route is used to build the link. If `payload.config.routes?.admin` is not set, `/admin` is used.
 * @returns A JSX element: a NavGroup with an anchor linking to `{adminBase}/seller/orders` and a label "Orders".
 */
export function SellerOrdersLink({ payload }: ServerProps) {
  const adminBase = payload.config.routes?.admin || '/admin';
  return (
    <NavGroup label="Seller">
      <a className="nav__link" href={`${adminBase}/seller/orders`}>
        <span className="nav__link-label">Orders</span>
      </a>
    </NavGroup>
  );
}