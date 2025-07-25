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
    // Only the target user (or admins) can read their own notifications: this may be incorrect.
    /* from code rabbit : Critical issue: Incorrect access control logic for read permissions.
    The current read access control is comparing the user's ID with the document ID instead of checking if the user is the notification recipient. This will always deny access since user IDs and notification document IDs are different entities.
    Apply this fix to correctly check if the user is the notification recipient:
    this doesn't quite work, investigate if it becomes an issue.

    -    read: ({ req: { user }, id }) => {
    +    read: ({ req: { user }, doc }) => {
          if (!user) return false;
    -      return user.id === id || isSuperAdmin(user);
    +      return user.id === doc?.user || isSuperAdmin(user);
        },
    */
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
          admin: {
            description: 'Brief preview of the message content'
          },
          type: 'text'
        },
        {
          name: 'messageId',
          label: 'Message ID',
          admin: {
            description:
              'Reference to the original message that triggered this notification'
          },
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
