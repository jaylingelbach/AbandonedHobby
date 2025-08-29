'use client';

import { Link } from '@payloadcms/ui';
import { HomeIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

export function AbandonedHobbyLink() {
  return (
    <div className="ah-link">
      <Link href="/" aria-label="Home" className="ah-link__inner">
        <HomeIcon
          aria-hidden="true"
          focusable="false"
          className="ah-link__icon"
        />
        <span className="ah-link__label">Abandoned Hobby</span>
      </Link>
    </div>
  );
}

export default AbandonedHobbyLink;
