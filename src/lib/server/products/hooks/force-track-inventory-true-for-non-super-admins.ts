import { isSuperAdmin } from '@/lib/access';
import type { CollectionBeforeValidateHook } from 'payload';

export const forceTrackInventoryTrueForNonAdmins: CollectionBeforeValidateHook =
  ({ data, req: { user } }) => {
    const next = { ...(data ?? {}) };

    // For non super-admins, always force trackInventory = true
    if (!isSuperAdmin(user)) {
      next.trackInventory = true;
    }

    return next;
  };
