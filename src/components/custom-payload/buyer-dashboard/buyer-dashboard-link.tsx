import { NavGroup } from '@payloadcms/ui';
import React from 'react';

import type { ServerProps } from 'payload';

/**
 * Render a navigation entry that links to the Buyer Dashboard in the admin UI.
 *
 * @param payload - Server props from Payload; used to determine the admin base route (`payload.config.routes?.admin`), falling back to `/admin`
 * @returns A React element: a `NavGroup` labeled "Buyer" containing a link to the buyer dashboard at `${adminBase}/buyer`
 */
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