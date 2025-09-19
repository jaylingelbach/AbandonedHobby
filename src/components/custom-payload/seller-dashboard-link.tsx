import React from 'react';
import type { ServerProps } from 'payload';
import { NavGroup } from '@payloadcms/ui';

export function SellerDashboardLink({ payload }: ServerProps) {
  const adminBase = payload.config.routes?.admin || '/admin';
  return (
    <NavGroup label="Seller">
      <a className="nav__link" href={`${adminBase}/seller`}>
        <span className="nav__link-label">Seller Dashboard</span>
      </a>
    </NavGroup>
  );
}
