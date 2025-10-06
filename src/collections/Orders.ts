import { isSuperAdmin } from '@/lib/access';
import {
  beforeChangeOrderShipment,
  canEditOrderFulfillmentStatus,
  canEditOrderShipment,
  readOrdersAccess,
  updateOrdersAccess,
} from '@/lib/server/payload-utils/orders';

import type { CollectionConfig, FieldAccess } from 'payload';

const readIfSuperAdmin: FieldAccess = ({ req }) => {
  const roles: string[] | undefined = req?.user?.roles as string[] | undefined;
  return Array.isArray(roles) && roles.includes('super-admin');
};

/**
 * Orders
 *
 * Canonical buyer field: `buyer`
 * - We removed the duplicate `user` field (was also a relationship to users).
 * - Run the migration below to copy `user` -> `buyer` and then drop `user`.
 *
 * Seller identity: `sellerTenant`
 * - This is the tenant that received payment; used for access scoping.
 *
 * Primary product reference (legacy): `product`
 * - Kept for compatibility / quick links. The authoritative list of purchased
 *   items is the `items[]` array (each with its own `product`).
 * - You can remove this later once all callers use `items[]`.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: readOrdersAccess,
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: updateOrdersAccess,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    // ----- Display / identifiers -----
    { name: 'name', type: 'text', required: true },
    {
      name: 'orderNumber',
      type: 'text',
      index: true,
      unique: true,
      required: true,
    },

    // ----- Buyer (canonical) -----
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    { name: 'buyerEmail', type: 'email' },

    // ----- Seller (tenant that was paid) -----
    {
      name: 'sellerTenant',
      label: 'Seller (Tenant)',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true, // faster access filters
    },

    // ----- Legacy primary product pointer (keep for compatibility) -----
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      hasMany: false,
      admin: {
        description:
          'Legacy primary product reference. The authoritative list is in `items[]`.',
      },
    },

    // ----- Accounting / Stripe refs -----
    {
      name: 'currency',
      type: 'text',
      required: true,
      validate: (value: unknown): true | string =>
        typeof value === 'string' && /^[A-Z]{3}$/.test(value)
          ? true
          : 'Currency must be ISO-4217 (e.g., USD)',
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'The total amount paid in cents (Stripe amount_total).',
      },
    },
    {
      name: 'stripeAccountId',
      type: 'text',
      index: true,
      required: true,
      admin: { description: 'The Stripe account associated with the order.' },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        description: 'The Stripe checkout session associated with the order.',
      },
    },
    {
      name: 'stripeEventId',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'stripeChargeId',
      type: 'text',
      index: true,
      admin: { readOnly: true },
    },

    // ----- Shipping address (kept for webhook / emails) -----
    {
      name: 'shipping',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'line1', type: 'text' },
        { name: 'line2', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'postalCode', type: 'text' },
        { name: 'country', type: 'text' },
      ],
    },

    // ----- Line items with quantity -----
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
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
          options: ['30 day', '14 day', '7 day', '1 day', 'no refunds'],
        },
        { name: 'returnsAcceptedThrough', type: 'date' },
      ],
    },

    // order-level returns cutoff (earliest eligible item)
    { name: 'returnsAcceptedThrough', type: 'date' },

    // ----- Statuses -----
    {
      name: 'status',
      type: 'select',
      defaultValue: 'paid',
      options: ['paid', 'refunded', 'partially_refunded', 'canceled'],
    },
    {
      name: 'fulfillmentStatus',
      type: 'select',
      defaultValue: 'unfulfilled',
      options: [
        { label: 'Unfulfilled', value: 'unfulfilled' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Returned', value: 'returned' },
      ],
      access: { update: canEditOrderFulfillmentStatus },
    },

    // bookkeeping / inventory guard
    {
      name: 'inventoryAdjustedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Set when stock was decremented',
      },
      index: true,
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'refundedTotalCents',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Amount of refund in cents',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },

    {
      name: 'lastRefundAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Set when last refunded',
      },
      index: true,
      access: {
        create: () => false,
        update: () => false,
      },
    },
    // ----- Shipment / Tracking (seller can edit) -----
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
            { label: 'Other', value: 'other' },
          ],
        },
        { name: 'trackingNumber', type: 'text' },
        { name: 'trackingUrl', type: 'text', admin: { readOnly: true } },
        { name: 'shippedAt', type: 'date', admin: { readOnly: true } },
      ],
    },
    // renders refund manager component
    {
      type: 'group',
      name: 'refunds',
      label: 'Issue Refund',
      access: {
        read: readIfSuperAdmin,
        create: () => false,
        update: readIfSuperAdmin,
      },
      admin: {
        description: 'Issue a refund for this order',
      },
      fields: [
        {
          type: 'ui',
          name: 'refundsUI',
          admin: {
            components: {
              Field:
                '@/components/custom-payload/refunds/refund-manager.tsx#RefundManager',
            },
          },
        },
      ],
    },
  ],
};
