// ─── Type-only Imports ───────────────────────────────────────────────────────
import type { CollectionConfig, FieldAccess } from 'payload';
import type { ShippingMode } from '@/modules/orders/types';

// ─── Access Control Utilities ────────────────────────────────────────────────
import { isSuperAdmin } from '@/lib/access';
import {
  beforeChangeOrderShipment,
  canEditOrderFulfillmentStatus,
  canEditOrderShipment,
  readOrdersAccess,
  updateOrdersAccess
} from '@/lib/server/payload-utils/orders';
import { afterChangeOrders } from '@/lib/server/payload-utils/order-afterChange';

// ─── Order Logic / Calculations ──────────────────────────────────────────────
import { lockAndCalculateAmounts } from '@/lib/server/orders/lock-and-calc-amounts';
import { autoSetDeliveredAt } from '@/lib/server/orders/auto-delivered-at';
import { computeLatestShippedAt } from '@/lib/server/orders/compute-latest-shipped-at';
import { mirrorShipmentsArrayToSingle } from '@/lib/server/orders/mirror-shipments-to-single';
import { mirrorSingleShipmentToArray } from '@/lib/server/orders/mirror-single-to-shipments';

// ─── Utilities ────────────────────────────────────────────────────
import { readQuantityOrDefault } from '@/lib/validation/quantity';

const readIfSuperAdmin: FieldAccess = ({ req }) => {
  const roles: string[] | undefined = req?.user?.roles as string[] | undefined;
  return Array.isArray(roles) && roles.includes('super-admin');
};

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    hidden: ({ user }) => !isSuperAdmin(user)
  },
  access: {
    read: readOrdersAccess,
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: updateOrdersAccess,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  hooks: {
    afterChange: [afterChangeOrders],
    beforeChange: [
      mirrorSingleShipmentToArray,
      mirrorShipmentsArrayToSingle,
      lockAndCalculateAmounts,
      async (args) => computeLatestShippedAt(args),
      autoSetDeliveredAt
    ],
    beforeValidate: [
      ({ data }) => {
        // Normalize shipping snapshots on each item
        if (data && Array.isArray((data as { items?: unknown }).items)) {
          const currentItems = (data as { items: unknown[] }).items;

          (data as { items: unknown[] }).items = currentItems.map((row) => {
            if (!row || typeof row !== 'object') return row;

            const item = row as Record<string, unknown>;

            // mode → required, validated, default 'free'
            const mode: ShippingMode =
              item.shippingMode === 'free' ||
              item.shippingMode === 'flat' ||
              item.shippingMode === 'calculated'
                ? (item.shippingMode as ShippingMode)
                : 'free';
            item.shippingMode = mode;

            // quantity default = 1 (integer >= 1)
            const quantity = readQuantityOrDefault(item.quantity);

            item.quantity = quantity;

            if (mode === 'flat') {
              const feeRaw = item.shippingFeeCentsPerUnit;
              const fee =
                typeof feeRaw === 'number' && Number.isFinite(feeRaw)
                  ? Math.max(0, Math.trunc(feeRaw))
                  : 0;

              const subtotal = fee * quantity;
              if (!Number.isSafeInteger(subtotal)) {
                throw new Error('Shipping subtotal exceeds safe integer range');
              }

              item.shippingFeeCentsPerUnit = fee;
              item.shippingSubtotalCents = subtotal;
            } else {
              if ('shippingFeeCentsPerUnit' in item) {
                delete item.shippingFeeCentsPerUnit;
              }
              if ('shippingSubtotalCents' in item) {
                delete item.shippingSubtotalCents;
              }
            }

            return item;
          });
        }
        return data;
      }
    ]
  },
  fields: [
    // ----- Display / identifiers -----
    { name: 'name', type: 'text', required: true },
    {
      name: 'orderNumber',
      type: 'text',
      index: true,
      unique: true,
      required: true
    },

    // ----- Buyer (canonical) -----
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true
    },
    { name: 'buyerEmail', type: 'email' },

    // ----- Seller (tenant that was paid) -----
    {
      name: 'sellerTenant',
      label: 'Seller (Tenant)',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true
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
          'Legacy primary product reference. The authoritative list is in `items[]`.'
      }
    },

    // ----- Accounting / Stripe refs -----
    {
      name: 'currency',
      type: 'text',
      required: true,
      validate: (value: unknown): true | string =>
        typeof value === 'string' && /^[A-Z]{3}$/.test(value)
          ? true
          : 'Currency must be ISO-4217 (e.g., USD)'
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
      name: 'stripeAccountId',
      type: 'text',
      index: true,
      required: true,
      admin: { description: 'The Stripe account associated with the order.' }
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
      unique: true,
      index: true,
      admin: { readOnly: true }
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
        { name: 'country', type: 'text' }
      ]
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
          required: true
        },
        { name: 'nameSnapshot', type: 'text', required: true },
        { name: 'unitAmount', type: 'number', required: true }, // cents
        { name: 'quantity', type: 'number', required: true, defaultValue: 1 },
        { name: 'amountSubtotal', type: 'number' }, // cents
        { name: 'amountTax', type: 'number' }, // cents
        { name: 'amountTotal', type: 'number' }, // cents

        // --- Per-line shipping snapshot and subtotal (all cents) ------------
        {
          name: 'shippingMode',
          type: 'select',
          hasMany: false,
          required: true,
          defaultValue: 'free',
          options: [
            { label: 'Free', value: 'free' },
            { label: 'Flat', value: 'flat' },
            { label: 'Calculated', value: 'calculated' }
          ],
          admin: { readOnly: true }, // snapshot – set by server
          access: { create: () => false, update: () => false }
        },
        {
          name: 'shippingFeeCentsPerUnit',
          type: 'number',
          min: 0,
          admin: { description: 'Only when mode = flat', readOnly: true },
          access: { create: () => false, update: () => false },
          validate: (
            value: unknown,
            { siblingData }: { siblingData?: { shippingMode?: string } }
          ): true | string => {
            if (value === null || value === undefined) return true;
            if (!Number.isInteger(value))
              return 'Shipping fee must be a whole number (cents)';
            if (
              siblingData?.shippingMode &&
              siblingData.shippingMode !== 'flat'
            ) {
              return 'Shipping fee per unit should only be set when mode is "flat"';
            }
            return true;
          }
        },
        {
          name: 'shippingSubtotalCents',
          type: 'number',
          min: 0,
          admin: {
            description: 'quantity-applied shipping for this line',
            readOnly: true
          },
          access: { create: () => false, update: () => false },
          validate: (value: unknown): true | string =>
            value == null || Number.isInteger(value)
              ? true
              : 'Must be an integer number of cents'
        },
        {
          name: 'refundPolicy',
          type: 'select',
          options: ['30 day', '14 day', '7 day', '1 day', 'no refunds']
        },
        { name: 'returnsAcceptedThrough', type: 'date' }
      ]
    },

    // order-level returns cutoff (earliest eligible item)
    { name: 'returnsAcceptedThrough', type: 'date' },

    // ----- Statuses -----
    {
      name: 'status',
      type: 'select',
      defaultValue: 'paid',
      options: ['paid', 'refunded', 'partially_refunded', 'canceled']
    },
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

    // bookkeeping / inventory guard
    {
      name: 'inventoryAdjustedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Set when stock was decremented'
      },
      index: true,
      access: {
        create: () => false,
        update: () => false
      }
    },
    {
      name: 'refundedTotalCents',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Amount of refund in cents'
      },
      access: {
        create: () => false,
        update: () => false
      }
    },

    {
      name: 'lastRefundAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Set when last refunded'
      },
      index: true,
      access: {
        create: () => false,
        update: () => false
      }
    },

    // ----- Shipment / Tracking (seller can edit) -----
    {
      type: 'group',
      name: 'shipment',
      access: { update: canEditOrderShipment },
      hooks: {
        beforeChange: [beforeChangeOrderShipment]
      },
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
        { name: 'shippedAt', type: 'date', admin: { readOnly: true } },
        {
          name: 'lastNotifiedKey',
          type: 'text',
          admin: {
            readOnly: true,
            description:
              'Tracks the last notification state/key sent for this shipment'
          }
        }
      ]
    },

    // renders refund manager component
    {
      type: 'group',
      name: 'refunds',
      label: 'Issue Refund',
      access: {
        read: readIfSuperAdmin,
        create: () => false,
        update: readIfSuperAdmin
      },
      admin: {
        description: 'Issue a refund for this order'
      },
      fields: [
        {
          type: 'ui',
          name: 'refundsUI',
          admin: {
            components: {
              Field:
                '@/components/custom-payload/refunds/refund-manager.tsx#RefundManager'
            }
          }
        }
      ]
    },

    // --- Money breakdown (order-level, cents) -----------------------------------------
    {
      type: 'group',
      name: 'amounts',
      admin: {
        description: 'Order-level money breakdown (all cents)',
        readOnly: true
      },
      access: { create: () => false, update: () => false },
      fields: [
        { name: 'subtotalCents', type: 'number', admin: { readOnly: true } },
        { name: 'taxTotalCents', type: 'number', admin: { readOnly: true } },
        {
          name: 'shippingTotalCents',
          type: 'number',
          admin: { readOnly: true }
        },
        {
          name: 'discountTotalCents',
          type: 'number',
          admin: { readOnly: true }
        },
        { name: 'platformFeeCents', type: 'number', admin: { readOnly: true } },
        { name: 'stripeFeeCents', type: 'number', admin: { readOnly: true } },
        { name: 'sellerNetCents', type: 'number', admin: { readOnly: true } }
      ]
    },

    // --- Documents / Links -------------------------------------------------------------
    {
      type: 'group',
      name: 'documents',
      fields: [
        { name: 'invoiceUrl', type: 'text' },
        { name: 'receiptUrl', type: 'text' }
      ]
    },

    // --- Shipment lifecycle ------------------------------------------------------------
    {
      name: 'latestShippedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description:
          'Most recent shippedAt across shipment + shipments[]. Used for sorting/pagination.'
      },
      index: true
    },
    {
      name: 'deliveredAt',
      type: 'date',
      admin: { description: 'Set when delivery is confirmed' },
      index: true
    },
    {
      name: 'canceledAt',
      type: 'date',
      admin: { description: 'Set if order is canceled' },
      index: true
    },
    {
      name: 'cancellationReason',
      type: 'text',
      admin: { description: 'Optional short note for cancellation' }
    },

    // --- Split shipments ---------------------------------------------------------------
    {
      name: 'shipments',
      type: 'array',
      admin: {
        description:
          'Advanced: multi-shipment history. The most recent entry mirrors into the main `shipment`.',
        condition: ({ user }) => isSuperAdmin(user)
      },
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
        { name: 'trackingUrl', type: 'text' },
        { name: 'shippedAt', type: 'date' },
        {
          name: 'items',
          type: 'array',
          fields: [
            {
              name: 'orderItemId',
              type: 'text',
              admin: { description: 'ID of the line item in orders.items[]' }
            },
            { name: 'quantity', type: 'number', min: 1 }
          ]
        }
      ]
    },

    // --- Returns / RMA scaffold --------------------------------------------------------
    {
      type: 'group',
      name: 'returns',
      admin: {
        description:
          'High-level return metadata (line-level lives in Refunds collection)'
      },
      fields: [
        { name: 'rmaNumber', type: 'text' },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Requested', value: 'requested' },
            { label: 'Approved', value: 'approved' },
            { label: 'In Transit', value: 'in_transit' },
            { label: 'Received', value: 'received' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Rejected', value: 'rejected' }
          ],
          defaultValue: 'none'
        }
      ]
    },

    // --- Reviews pivot -----------------------------------------------------------------
    {
      type: 'group',
      name: 'reviews',
      fields: [
        { name: 'hasReview', type: 'checkbox', defaultValue: false },
        { name: 'reviewId', type: 'relationship', relationTo: 'reviews' }
      ]
    },

    // --- Support / Conversation pivot ---------------------------------------------------
    {
      type: 'group',
      name: 'support',
      fields: [
        {
          name: 'conversation',
          type: 'relationship',
          relationTo: 'conversations',
          admin: { description: 'Primary buyer-seller thread for this order' }
        },
        { name: 'lastBuyerViewedAt', type: 'date' }
      ]
    },

    // --- Notes (visibility-aware) -------------------------------------------------------
    {
      name: 'buyerNotes',
      type: 'textarea',
      admin: { description: 'Visible to buyer and seller' }
    },
    {
      name: 'sellerPrivateNotes',
      type: 'textarea',
      admin: { description: 'Internal notes visible only to seller/admin' },
      access: {
        read: canEditOrderShipment,
        update: canEditOrderShipment
      }
    }
  ]
};
