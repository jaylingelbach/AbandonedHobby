import { isSuperAdmin } from '@/lib/access';
import type { CollectionConfig } from 'payload';

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  access: {
    read: ({ req: { user } }) => isSuperAdmin(user),
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },

  admin: {
    useAsTitle: 'description'
  },
  indexes: [
    {
      fields: ['user', 'product'],
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
      hasMany: false,
      required: true
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      required: true
    }
  ]
};
