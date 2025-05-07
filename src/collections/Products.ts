import { CollectionConfig } from 'payload';

export const Products: CollectionConfig = {
  slug: 'products',
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
      name: 'image',
      type: 'upload',
      relationTo: 'media'
    },
    {
      name: 'refundPolicy',
      type: 'select',
      options: ['30 days', '14 days', '7 days', '1 day', 'no refunds'],
      defaultValue: '30 days'
    }
  ]
};
