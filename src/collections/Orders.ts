import { isSuperAdmin } from '@/lib/access';
import type { CollectionConfig } from 'payload';
import {
  readOrdersAccess,
  updateOrdersAccess,
  canEditOrderShipment,
  canEditOrderFulfillmentStatus,
  beforeChangeOrderShipment
} from '@/lib/server/payload-utils/orders';

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: readOrdersAccess,
    create: ({ req }) => isSuperAdmin(req.user),
    update: updateOrdersAccess,
    delete: ({ req }) => isSuperAdmin(req.user)
  },
  admin: {
    useAsTitle: 'name' // keep your original title field
  },
  fields: [
    { name: 'name', type: 'text', required: true },

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
        description: 'The Stripe account associated with the order.'
      }
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        description: 'The Stripe checkout session associated with the order.'
      }
    },
    {
      name: 'stripeEventId',
      type: 'text',
      index: true,
      admin: { readOnly: true }
    },

    {
      name: 'total',
      type: 'number',
      required: true,
      min: 0,
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
      required: true,
      index: true // speeds up access filters
    },

    { name: 'buyerEmail', type: 'email' },
    {
      name: 'currency',
      type: 'text',
      required: true,
      validate: (value: unknown): true | string => {
        return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
          ? true
          : 'Currency must be ISO-4217 (e.g., USD)';
      }
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      index: true,
      admin: { readOnly: true }
    },
    {
      name: 'stripeChargeId',
      type: 'text',
      index: true,
      admin: { readOnly: true }
    },

    // Shipping address group (kept for webhook compatibility)
    {
      name: 'shipping',
      type: 'group',
      required: false,
      fields: [
        { name: 'name', type: 'text' },
        { name: 'line1', type: 'text' },
        { name: 'line2', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'postalCode', type: 'text' },
        { name: 'country', type: 'text' }
      ]
    },

    // Line items with quantity
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
        { name: 'nameSnapshot', type: 'text', required: true },
        { name: 'unitAmount', type: 'number', required: true }, // cents
        { name: 'quantity', type: 'number', required: true, defaultValue: 1 },
        { name: 'amountSubtotal', type: 'number' }, // cents
        { name: 'amountTax', type: 'number' }, // cents
        { name: 'amountTotal', type: 'number' }, // cents
        {
          name: 'refundPolicy',
          type: 'select',
          options: ['30 day', '14 day', '7 day', '1 day', 'no refunds']
        },
        { name: 'returnsAcceptedThrough', type: 'date' }
      ]
    },

    // Order-level returns cutoff (earliest eligible item)
    { name: 'returnsAcceptedThrough', type: 'date' },

    {
      name: 'status',
      type: 'select',
      defaultValue: 'paid',
      options: ['paid', 'refunded', 'partially_refunded', 'canceled']
    },

    {
      name: 'inventoryAdjustedAt',
      type: 'date',
      admin: { readOnly: true, description: 'Set when stock was decremented' },
      index: true,
      access: { create: () => false, update: () => false }
    },

    // Fulfillment (seller can edit)
    {
      name: 'fulfillmentStatus',
      type: 'select',
      defaultValue: 'unfulfilled',
      options: [
        { label: 'Unfulfilled', value: 'unfulfilled' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Returned', value: 'returned' }
      ],
      access: { update: canEditOrderFulfillmentStatus }
    },

    // Shipment / Tracking (seller can edit)
    {
      type: 'group',
      name: 'shipment',
      access: { update: canEditOrderShipment },
      hooks: { beforeChange: [beforeChangeOrderShipment] },
      fields: [
        {
          name: 'carrier',
          type: 'select',
          options: [
            { label: 'USPS', value: 'usps' },
            { label: 'UPS', value: 'ups' },
            { label: 'FedEx', value: 'fedex' },
            { label: 'Other', value: 'other' }
          ]
        },
        { name: 'trackingNumber', type: 'text' },
        { name: 'trackingUrl', type: 'text', admin: { readOnly: true } },
        { name: 'shippedAt', type: 'date', admin: { readOnly: true } }
      ]
    }
  ]
};
