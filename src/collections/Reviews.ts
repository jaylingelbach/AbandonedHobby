import { isSuperAdmin } from '@/lib/access';

import type { CollectionConfig } from 'payload';

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  hooks: {
    beforeChange: [
      ({ req, data, operation }) => {
        if (operation === 'create' && req.user) {
          data.user = req.user.id;
        }
        return data;
      }
    ]
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },

  admin: {
    useAsTitle: 'description'
  },
  indexes: [
    {
      fields: ['user', 'tenant'],
      unique: true
    }
  ],
  fields: [
    {
      name: 'description',
      type: 'textarea',
      required: true
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: false
    },
    {
      name: 'user', // buyer
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      required: true
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true
    },
    {
      name: 'tenant', // seller
      type: 'relationship',
      relationTo: 'tenants',
      required: true
    }
  ]
};
