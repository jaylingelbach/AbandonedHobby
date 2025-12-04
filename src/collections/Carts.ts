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
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Prefer the new items if provided, else fall back to original
        const items = Array.isArray(data.items)
          ? data.items
          : Array.isArray(originalDoc?.items)
            ? originalDoc.items
            : [];

        return {
          ...data,
          itemCount: items.length
        };
      }
    ],
    beforeValidate: [
      ({ data, originalDoc }) => {
        // Use "effective" values: provided in this operation, or from existing doc on update
        const effectiveBuyer =
          data?.buyer !== undefined ? data.buyer : originalDoc?.buyer;
        const effectiveGuest =
          data?.guestSessionId !== undefined
            ? data.guestSessionId
            : originalDoc?.guestSessionId;

        const hasBuyer = Boolean(effectiveBuyer);
        const hasGuest = Boolean(effectiveGuest);

        if (!hasBuyer && !hasGuest) {
          throw new Error('Cart must have either a buyer or a guestSessionId.');
        }

        if (hasBuyer && hasGuest) {
          throw new Error(
            'Cart cannot have both a buyer and a guestSessionId at the same time.'
          );
        }

        return data;
      }
    ]
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
      required: false,
      min: 0,
      defaultValue: 0
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
