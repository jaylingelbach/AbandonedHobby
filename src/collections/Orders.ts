import { isSuperAdmin } from '@/lib/access';
import { sendEmail } from '@/lib/sendEmail';
import type { CollectionConfig } from 'payload';

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: ({ req: { user } }) => isSuperAdmin(user),
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
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
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      hasMany: false
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      hasMany: false
    },
    {
      name: 'stripeAccountId',
      type: 'text',
      required: true,
      admin: {
        description: 'The Stripe account associated with the order. '
      }
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      admin: {
        description: 'The Stripe checkout session associated with the order. '
      }
    }
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        console.log(`afterChange fired: ${operation}`);
        if (operation === 'create') {
          console.log('CREATE EMAIL');
          await sendEmail({
            // to: doc.buyerEmail,
            to: 'jay@abandonedhobby.com',
            subject: 'Order Confirmation - Abandoned Hobbies',
            html: `
              <h2>Thanks for your purchase!</h2>
              <p>You bought <strong>${doc.product.name}</strong> for $${doc.total}</p>
              <p>We'll notify the seller and they'll follow up soon.</p>
            `
          });
        }
      }
    ]
  }
};
