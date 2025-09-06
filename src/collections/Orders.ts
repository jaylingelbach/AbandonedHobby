import { isSuperAdmin } from '@/lib/access';
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
      index: true,
      required: true,
      admin: {
        description: 'The Stripe account associated with the order. '
      }
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
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
    },
    {
      name: 'orderNumber',
      type: 'text',
      index: true,
      unique: true,
      required: true
    },
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'sellerTenant',
      label: 'Seller (Tenant)',
      type: 'relationship',
      relationTo: 'tenants',
      required: true
    },
    {
      name: 'buyerEmail',
      type: 'email'
    },
    {
      name: 'currency',
      type: 'text',
      required: true
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      index: true
    },
    {
      name: 'stripeChargeId',
      type: 'text',
      index: true
    },
    // line items w/ quantity (no change to Products collection)
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true
        },
        {
          name: 'nameSnapshot',
          type: 'text',
          required: true
        },
        {
          name: 'unitAmount',
          type: 'number',
          required: true
        }, // cents
        {
          name: 'quantity',
          type: 'number',
          required: true,
          defaultValue: 1
        },
        {
          name: 'amountSubtotal',
          type: 'number'
        }, // cents
        {
          name: 'amountTax',
          type: 'number'
        }, // cents
        {
          name: 'amountTotal',
          type: 'number'
        }, // cents
        {
          name: 'refundPolicy',
          type: 'select',
          options: ['30 day', '14 day', '7 day', '1 day', 'no refunds']
        },
        {
          name: 'returnsAcceptedThrough',
          type: 'date'
        }
      ]
    },
    // order-level returns cutoff (earliest eligible item)
    {
      name: 'returnsAcceptedThrough',
      type: 'date'
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'paid',
      options: ['paid', 'refunded', 'partially_refunded', 'canceled']
    }
  ]
};
