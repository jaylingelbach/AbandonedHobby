import { isSuperAdmin } from '@/lib/access';
import { CollectionConfig } from 'payload';

export const Refunds: CollectionConfig = {
  slug: 'refunds',
  admin: {
    hidden: true,
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'amount', 'status', 'createdAt']
  },
  access: {
    read: ({ req: { user } }) => isSuperAdmin(user),
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      index: true
    },
    { name: 'orderNumber', type: 'text', required: true, index: true },
    { name: 'stripeRefundId', type: 'text', required: true, index: true },
    { name: 'stripePaymentIntentId', type: 'text' },
    { name: 'stripeChargeId', type: 'text' },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: { description: 'Cents' }
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'succeeded',
      options: [
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Pending', value: 'pending' },
        { label: 'Failed', value: 'failed' },
        { label: 'Canceled', value: 'canceled' }
      ]
    },
    {
      name: 'reason',
      type: 'select',
      options: [
        { label: 'Requested by Customer', value: 'requested_by_customer' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Fraudulent', value: 'fraudulent' },
        { label: 'Other', value: 'other' }
      ]
    },
    {
      name: 'selections',
      type: 'array',
      labels: { singular: 'Line', plural: 'Lines' },
      fields: [
        { name: 'itemId', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true },
        { name: 'unitAmount', type: 'number', required: true }, // snapshot used to compute
        { name: 'amountTotal', type: 'number', required: true } // snapshot used to compute
      ]
    },
    {
      name: 'fees',
      type: 'group',
      fields: [
        { name: 'restockingFeeCents', type: 'number' },
        { name: 'refundShippingCents', type: 'number' } // if you also refund shipping
      ]
    },
    { name: 'notes', type: 'textarea' },
    { name: 'idempotencyKey', type: 'text', index: true }
  ]
};
