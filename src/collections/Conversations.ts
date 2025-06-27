// collections/Conversations.ts
import { CollectionConfig } from 'payload';

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => !!user,
    update: () => false,
    delete: () => false
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['product', 'buyer', 'seller']
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true
    },
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'seller',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'roomId',
      type: 'text',
      required: true
    }
  ],
  timestamps: true
};
