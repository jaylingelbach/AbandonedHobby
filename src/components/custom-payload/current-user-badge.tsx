'use client';

import { useAuth } from '@payloadcms/ui';

export const dynamic = 'force-dynamic';

export function CurrentUserBadge() {
  const { user } = useAuth();
  if (!user) return null;

  const displayName = user.username?.trim() || user.email?.trim() || '';
  return (
    <div className="current-user-badge">
      <div className="current-user-text">
        <div className="current-user-label">Signed in as:</div>
        <div className="current-user-value">{displayName}</div>
      </div>
    </div>
  );
}

export default CurrentUserBadge;
