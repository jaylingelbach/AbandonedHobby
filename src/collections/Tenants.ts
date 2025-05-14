import type { CollectionConfig } from 'payload';

export const Tenants: CollectionConfig = {
  slug: 'tenants',
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
      admin: {
        description: `This is the subdomain of the store (e.g. [slug].abandonedhobby.com)`
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
      admin: {
        readOnly: true
      }
    },
    {
      name: 'stripeDetailsSubmitted',
      type: 'checkbox',
      admin: {
        readOnly: true,
        description:
          'You can not sell products until you have submitted your Stripe details. '
      }
    }
  ]
};
