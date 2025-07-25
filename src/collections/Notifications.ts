// src/collections/Notifications.ts
import { CollectionConfig } from 'payload';
import { isSuperAdmin } from '@/lib/access';

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'type',
    defaultColumns: ['user', 'type', 'createdAt', 'read'],
    description: 'In-app notifications for users'
  },
  access: {
    // Only the target user (or admins) can read their own notifications:
    read: ({ req: { user }, id }) => {
      if (!user) return false;
      return user.id === id || isSuperAdmin(user);
    },
    create: () => false, // notifications are created via hook, not manually
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  fields: [
    {
      name: 'user',
      label: 'Recipient',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { label: 'Message', value: 'message' }
        // add more types here (e.g. 'order', 'system', etc.)
      ],
      required: true,
      defaultValue: 'message'
    },
    {
      name: 'payload',
      label: 'Payload',
      type: 'group',
      fields: [
        {
          name: 'conversationId',
          label: 'Conversation ID',
          type: 'text',
          required: true
        },
        {
          name: 'sender',
          label: 'Sender',
          type: 'relationship',
          relationTo: 'users',
          required: true
        },
        {
          name: 'excerpt',
          label: 'Excerpt',
          type: 'text'
        },
        {
          name: 'messageId',
          label: 'Message ID',
          type: 'text'
        }
      ]
    },
    {
      name: 'read',
      label: 'Read?',
      type: 'checkbox',
      defaultValue: false
    }
  ],
  timestamps: true
};
