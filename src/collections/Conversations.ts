import { isSuperAdmin } from '@/lib/access';

import type { CollectionConfig, Access, Where } from 'payload';

const canReadOwnConversations: Access = ({ req }) => {
  const user = req.user;
  if (!user) return false;
  if (isSuperAdmin(user)) return true; // bypass for admins while debugging

  const where: Where = {
    or: [{ buyer: { equals: user.id } }, { seller: { equals: user.id } }]
  };
  return where;
};

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  access: {
    read: canReadOwnConversations,
    create: ({ req }) => !!req.user,
    update: () => false,
    delete: ({ req }) => isSuperAdmin(req.user)
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['product', 'buyer', 'seller'],
    hidden: ({ user }) => !isSuperAdmin(user)
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
    { name: 'roomId', type: 'text', required: true }
  ],
  timestamps: true
};
