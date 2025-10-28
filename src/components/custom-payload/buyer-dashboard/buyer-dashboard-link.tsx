import { NavGroup } from '@payloadcms/ui';
import React from 'react';

import type { ServerProps } from 'payload';

export function BuyerDashboardLink({ payload }: ServerProps) {
  const adminBase = payload.config.routes?.admin || '/admin';
  return (
    <NavGroup label="Buyer">
      <a className="nav__link" href={`${adminBase}/buyer`}>
        <span className="nav__link-label">Buyer Dashboard</span>
      </a>
    </NavGroup>
  );
}
