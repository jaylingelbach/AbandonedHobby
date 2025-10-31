import { CollectionConfig } from 'payload';

import { isSuperAdmin } from '@/lib/access';
import { createNotificationOnNewMessage } from '@/lib/server/messages/create-notification-on-new-message';

export const Messages: CollectionConfig = {
  slug: 'messages',
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['conversationId', 'sender', 'createdAt'],
    hidden: ({ user }) => !isSuperAdmin(user)
  },
  fields: [
    {
      name: 'conversationId',
      type: 'text',
      required: true
    },
    {
      name: 'sender',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'receiver',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'content',
      type: 'textarea',
      required: true
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: false
    },
    {
      name: 'read',
      type: 'checkbox',
      defaultValue: false
    }
  ],
  timestamps: true,
  hooks: {
    afterChange: [createNotificationOnNewMessage]
  }
};
