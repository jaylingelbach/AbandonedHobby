import type { CollectionConfig } from 'payload';

export const PendingCheckoutAttempts: CollectionConfig = {
  slug: 'pending-checkout-attempts',
  admin: {
    useAsTitle: 'attemptId'
  },
  access: {
    // You can tighten this later; for now, keep simple so internal code can read/write
    read: () => false, // no one in admin UI needs to see this
    create: () => true,
    update: () => false,
    delete: () => true
  },
  fields: [
    {
      name: 'attemptId',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'userId',
      type: 'text',
      required: true
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true
    }
  ]
};
