// src/components/custom-payload/seller-orders-link.tsx
import { NavGroup } from '@payloadcms/ui';
import type { ServerProps } from 'payload';

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
