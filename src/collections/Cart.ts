import { isSuperAdmin } from '@/lib/access';
import { CollectionConfig } from 'payload';

export const Cart: CollectionConfig = {
  slug: 'carts',
  timestamps: true,
  admin: {
    hidden: ({ user }) => !isSuperAdmin(user)
  },
  access: {
    read: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true;
      if (!user) return false;
      return { buyer: { equals: user.id } };
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true;
      if (!user) return false;
      return { buyer: { equals: user.id } };
    },
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  fields: [
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      index: true
    },
    {
      name: 'guestSessionId',
      type: 'text',
      required: false,
      index: true
    },
    {
      name: 'sellerTenant',
      label: 'Seller (Tenant)',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true
    },
    {
      name: 'status',
      type: 'select',
      options: ['active', 'converted', 'abandoned', 'archived'],
      required: true,
      defaultValue: 'active',
      index: true
    },
    {
      name: 'itemCount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      required: true
    },
    {
      name: 'items',
      type: 'array',
      required: false,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true
        },
        {
          name: 'nameSnapshot',
          type: 'text',
          required: true
        },
        {
          name: 'unitAmountCents',
          type: 'number',
          min: 0,
          required: true
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          defaultValue: 1,
          min: 1
        },
        {
          name: 'addedAt',
          type: 'date'
        },
        {
          name: 'imageSnapshot',
          type: 'relationship',
          relationTo: 'media',
          required: false
        },
        {
          name: 'shippingModeSnapshot',
          type: 'select',
          options: ['free', 'flat', 'calculated'],
          required: false
        }
      ]
    },
    {
      name: 'currency',
      type: 'select',
      options: ['USD'],
      defaultValue: 'USD'
    },
    {
      name: 'source',
      type: 'text'
    }
  ]
};
