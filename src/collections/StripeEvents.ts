import { isSuperAdmin } from '@/lib/access';

import type { CollectionConfig } from 'payload';

export const StripeEvents: CollectionConfig = {
  slug: 'stripe_events',
  access: {
    read: ({ req: { user } }) => isSuperAdmin(user),
    create: () => true,
    update: () => false,
    delete: () => false
  },
  admin: {
    useAsTitle: 'eventId'
  },
  fields: [
    {
      name: 'eventId',
      type: 'text',
      required: true,
      unique: true
    }
  ],
  timestamps: true
};
