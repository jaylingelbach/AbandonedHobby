import { NavGroup, Link } from '@payloadcms/ui';
import React from 'react';

import type { ServerProps } from 'payload';

export function SellerDashboardLink({ payload }: ServerProps) {
  const adminBase = payload.config.routes?.admin || '/admin';
  return (
    <NavGroup label="Seller">
      <Link className="nav__link" href={`${adminBase}/seller`}>
        <span className="nav__link-label">Seller Dashboard</span>
      </Link>
    </NavGroup>
  );
}
