import { isSuperAdmin } from '@/lib/access';
import type { CollectionConfig } from 'payload';

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    hidden: ({ user }) => !isSuperAdmin(user)
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true
    }
  ],
  upload: true
};
