import { CollectionConfig } from 'payload';
import { isSuperAdmin } from '@/lib/access';

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
    // req is the Web Request object. This is mocked for Local API operations.
    // https://developer.mozilla.org/en-US/docs/Web/API/Request
    afterChange: [
      async ({ operation, doc, req }) => {
        // Only fire on new messages
        if (operation === 'create' && doc.receiver) {
          try {
            await req.payload.create({
              collection: 'notifications', // The Collection in which this Hook is running against.
              // The incoming data passed through the operation.
              data: {
                user: doc.receiver, // who should see it
                type: 'message',
                payload: {
                  conversationId: doc.conversationId,
                  sender:
                    typeof doc.sender === 'string'
                      ? doc.sender
                      : doc.sender.toString(),
                  excerpt: doc.content.slice(0, 50), // first 50 chars
                  messageId: doc.id
                }
              }
            });
          } catch (error) {
            req.payload.logger.error('Failed to create notification:', error);
          }
        }
      }
    ]
  }
};
