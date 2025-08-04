import { isSuperAdmin } from '@/lib/access';
import { sendOrderConfirmationEmail } from '@/lib/sendEmail';
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
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      admin: {
        description: 'The total amount paid in cents (Stripe amount_total).'
      }
    }
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        console.log(`afterChange fired: ${operation}`);
        console.log(`DOC: ${doc}`);
        if (operation === 'create') {
          await sendOrderConfirmationEmail({
            to: 'jay@abandonedhobby.com',
            name: doc.user.name,
            creditCardStatement:
              doc.paymentIntent.charges.data[0].statement_descriptor,
            creditCardBrand:
              doc.paymentIntent.charges.data[0].payment_method_details.card
                .brand,
            creditCardLast4:
              doc.paymentIntent.charges.data[0].payment_method_details.card
                .last4,
            receiptId: doc.order.id,
            orderDate: new Date().toLocaleDateString('en-US'),
            lineItems: [
              {
                description: doc.product.name,
                amount: `$${(doc.product.price / 100).toFixed(2)}`
              }
            ],
            total: `$${(doc.amount_total / 100).toFixed(2)}`
          });
        }
      }
    ]
  }
};
