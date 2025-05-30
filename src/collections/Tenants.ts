import type { CollectionConfig } from 'payload';

import { isSuperAdmin } from '@/lib/access';

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'slug'
  },
  fields: [
    {
      name: 'name',
      required: true,
      type: 'text',
      label: 'Shop name',
      admin: {
        description: `This is the name of the store (e.g. Jay's store)`
      }
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      required: true,
      unique: true,
      access: {
        update: ({ req: { user } }) => isSuperAdmin(user)
      },
      admin: {
        description: `This is the subdomain of the store (e.g. [slug].abandonedhobby.com), if you would like to update this please contact us.`
      }
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media'
    },
    {
      name: 'stripeAccountId',
      type: 'text',
      required: true,
      access: {
        update: ({ req: { user } }) => isSuperAdmin(user)
      },
      admin: {
        description: 'Stripe Account ID associated with your shop'
      }
    },
    {
      name: 'stripeDetailsSubmitted',
      type: 'checkbox',
      access: {
        update: ({ req: { user } }) => isSuperAdmin(user)
      },
      admin: {
        readOnly: true,
        description: 'You can not sell products until you have submitted your Stripe details. '
      }
    }
  ]
};
