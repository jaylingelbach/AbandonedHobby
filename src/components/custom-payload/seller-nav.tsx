import { NavGroup } from '@payloadcms/ui';
import type { ServerProps } from 'payload';

/**
 * Render a "Seller" navigation group for the admin interface.
 *
 * Uses the provided `payload` to resolve the admin base path (from `payload.config.routes?.admin`, defaulting to `/admin`)
 * and produces two links: "Seller Dashboard" and "Orders".
 *
 * @param payload - ServerProps from Payload CMS used to determine the admin base route for the generated links
 * @returns A React element containing a NavGroup labeled "Seller" with links to the seller dashboard and orders pages
 */
export function SellerNav({ payload }: ServerProps) {
  const adminBase = payload.config.routes?.admin || '/admin';

  return (
    <NavGroup label="Seller">
      <a className="nav__link" href={`${adminBase}/seller`}>
        <span className="nav__link-label">Seller Dashboard</span>
      </a>
      <a className="nav__link" href={`${adminBase}/seller/orders`}>
        <span className="nav__link-label">Orders</span>
      </a>
    </NavGroup>
  );
}