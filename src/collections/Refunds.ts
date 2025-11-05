import { isSuperAdmin } from '@/lib/access';
import type { CollectionConfig, Payload } from 'payload';
import { recomputeRefundState } from '@/modules/refunds/utils';
import { getRelId } from '@/lib/server/utils';
import type { Refund } from '@/payload-types';

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
    // Core refund info
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      index: true
    },
    { name: 'orderNumber', type: 'text', required: true, index: true },
    {
      name: 'stripeRefundId',
      type: 'text',
      required: true,
      index: true,
      unique: true
    },
    { name: 'stripePaymentIntentId', type: 'text' },
    { name: 'stripeChargeId', type: 'text' },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Cents' }
    },

    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
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

    //  Store both quantity and amount selections
    {
      name: 'selections',
      type: 'blocks',
      labels: { singular: 'Selection', plural: 'Selections' },
      blocks: [
        {
          slug: 'quantity',
          labels: { singular: 'Quantity', plural: 'Quantities' },
          fields: [
            { name: 'itemId', type: 'text', required: true },
            { name: 'quantity', type: 'number', required: true, min: 1 },

            // optional snapshots to make audit math easy:
            { name: 'unitAmount', type: 'number', min: 0 }, // cents
            { name: 'amountTotal', type: 'number', min: 0 } // cents
          ]
        },
        {
          slug: 'amount',
          labels: { singular: 'Amount', plural: 'Amounts' },
          fields: [
            { name: 'itemId', type: 'text', required: true },
            { name: 'amountCents', type: 'number', required: true, min: 1 } // cents
          ]
        }
      ]
    },

    {
      name: 'fees',
      type: 'group',
      fields: [
        { name: 'restockingFeeCents', type: 'number', min: 0 },
        { name: 'refundShippingCents', type: 'number', min: 0 }
      ]
    },

    { name: 'notes', type: 'textarea' },
    { name: 'idempotencyKey', type: 'text', index: true, unique: true }
  ],

  hooks: {
    afterChange: [
      async ({ req, doc }: { req: { payload: Payload }; doc: Refund }) => {
        const orderId = getRelId(doc.order);
        if (!orderId) return;

        await recomputeRefundState({
          payload: req.payload,
          orderId,
          includePending: false
        });
      }
    ],
    afterDelete: [
      async ({ req, doc }: { req: { payload: Payload }; doc: Refund }) => {
        const orderId = getRelId(doc.order);
        if (!orderId) return;

        await recomputeRefundState({
          payload: req.payload,
          orderId,
          includePending: false
        });
      }
    ]
  }
};
