import { CollectionConfig } from 'payload';

import { isSuperAdmin } from '@/lib/access';
import { Tenant } from '@/payload-types';

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    // do not need other rules here because products are connected to tenants and those rules are handled seperately.
    create: ({ req: { user } }) => {
      // can only post products if their stripe details are submitted. Will I need to refactor if they only want to trade (list as $0)?
      if (isSuperAdmin(user)) return true;
      const tenant = user?.tenants?.[0]?.tenant as Tenant;
      return Boolean(tenant?.stripeDetailsSubmitted);
    },
    delete: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'name',
    description: 'You must verify your account before listing products'
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    // TODO: change to RichText
    {
      name: 'description',
      type: 'text'
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      admin: {
        description: 'In USD'
      },
      validate: (value: number | undefined | null) => {
        if (value === undefined || value === null) return 'Price is required';
        if (value < 0) return 'Price cannot be negative';
        return true;
      }
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false // one product can only belong to one category
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media'
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media'
    },
    {
      name: 'refundPolicy',
      type: 'select',
      options: ['30 day', '14 day', '7 day', '1 day', 'no refunds'],
      defaultValue: '30 day'
    },
    {
      name: 'content',
      // TODO: change to RichText
      type: 'textarea',
      // Don't think i'll need this text area below.
      admin: {
        description:
          'Protected content only visible to customers after purchase. If there are downloadable assets can be added here. '
      }
    }
  ]
};
