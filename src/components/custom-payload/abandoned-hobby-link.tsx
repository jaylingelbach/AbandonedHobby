'use client';

import { Link } from '@payloadcms/ui';
import { HomeIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

export function AbandonedHobbyLink() {
  return (
    <div style={{ fontWeight: 'bold', paddingBottom: '1rem' }}>
      <Link href="/" aria-label="Home">
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <HomeIcon
            aria-hidden="true"
            focusable="false"
            style={{ marginRight: '0.5rem' }}
          />
          <span>Home</span>
        </span>
      </Link>
    </div>
  );
}

export default AbandonedHobbyLink;
