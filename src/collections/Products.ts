import { CollectionConfig } from 'payload';

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name'
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
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
    }
  ]
};
