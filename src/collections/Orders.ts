import { isSuperAdmin } from '@/lib/access';
import type {
  Access,
  CollectionConfig,
  FieldAccess,
  FieldHook,
  Where
} from 'payload';

// ---------- Helpers ----------
function getTenantIdsFromUser(user: unknown): string[] {
  const u = user as { tenants?: Array<{ id: string }> } | undefined;
  return Array.isArray(u?.tenants) ? u.tenants.map((t) => t.id) : [];
}

// For field-level checks (doc is available here)
function isSellerOfDoc(doc: unknown, user: unknown): boolean {
  const tenantIds = getTenantIdsFromUser(user);
  if (!tenantIds.length) return false;

  const d = doc as
    | { sellerTenant?: string | { id?: string } }
    | null
    | undefined;
  const sellerTenant = d?.sellerTenant;
  const targetTenantId =
    typeof sellerTenant === 'string' ? sellerTenant : sellerTenant?.id;

  return !!targetTenantId && tenantIds.includes(targetTenantId);
}

// ---------- Collection-level access (can return Where filter) ----------
const readAccess: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) return true;
  const tenantIds = getTenantIdsFromUser(req.user);
  if (!tenantIds.length) return false;

  const where: Where = { sellerTenant: { in: tenantIds } }; // ⬅️ typed as `Where`
  return where;
};

const updateAccess: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) return true;
  const tenantIds = getTenantIdsFromUser(req.user);
  if (!tenantIds.length) return false;

  const where: Where = { sellerTenant: { in: tenantIds } }; // ⬅️ typed as `Where`
  return where;
};

// Field-level access MUST return boolean
const canEditShipment: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfDoc(doc, req.user);

const canEditFulfillmentStatus: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfDoc(doc, req.user);

// ---------- Hooks ----------
const beforeChangeShipment: FieldHook = ({ data }) => {
  const hasTracking =
    typeof data?.shipment?.trackingNumber === 'string' &&
    data.shipment.trackingNumber.trim().length > 0;

  if (hasTracking) {
    const carrier = data.shipment?.carrier as string | undefined;
    const number = data.shipment?.trackingNumber as string;

    let url = '';
    if (carrier === 'usps') {
      url = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(
        number
      )}`;
    } else if (carrier === 'ups') {
      url = `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(
        number
      )}`;
    } else if (carrier === 'fedex') {
      url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(
        number
      )}`;
    }

    data.shipment.trackingUrl = url || data.shipment.trackingUrl;

    if (data.fulfillmentStatus === 'unfulfilled') {
      data.fulfillmentStatus = 'shipped';
    }
    if (!data.shipment.shippedAt) {
      data.shipment.shippedAt = new Date().toISOString();
    }
  }

  return data;
};

// ---------- Collection ----------
export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: readAccess,
    create: ({ req }) => isSuperAdmin(req.user),
    update: updateAccess,
    delete: ({ req }) => isSuperAdmin(req.user)
  },
  admin: {
    useAsTitle: 'orderNumber'
  },
  fields: [
    // ----- Core identifiers -----
    {
      name: 'orderNumber',
      type: 'text',
      index: true,
      unique: true,
      required: true
    },

    // who is buying / selling
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    {
      name: 'buyerEmail',
      type: 'email'
    },
    {
      name: 'sellerTenant',
      label: 'Seller (Tenant)',
      type: 'relationship',
      relationTo: 'tenants',
      required: true
    },

    // accounting / stripe refs
    {
      name: 'currency',
      type: 'text',
      required: true
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
      name: 'stripeAccountId',
      type: 'text',
      index: true,
      required: true,
      admin: {
        description: 'The Stripe account associated with the order.'
      },
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        description: 'The Stripe checkout session associated with the order.'
      },
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },
    {
      name: 'stripeEventId',
      type: 'text',
      index: true,
      admin: { readOnly: true },
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      index: true,
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },
    {
      name: 'stripeChargeId',
      type: 'text',
      index: true,
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },

    // ----- Statuses -----
    {
      name: 'status',
      type: 'select',
      defaultValue: 'paid',
      options: ['paid', 'refunded', 'partially_refunded', 'canceled'],
      access: { update: ({ req }) => isSuperAdmin(req.user) }
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
      access: { update: canEditFulfillmentStatus }
    },

    // ----- Shipping ADDRESS (renamed from "shipping" to avoid name collision) -----
    {
      name: 'shippingAddress',
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
      ],
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },

    // ----- Items -----
    {
      name: 'items',
      type: 'array',
      required: true,
      access: { update: ({ req }) => isSuperAdmin(req.user) },
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

    // order-level returns cutoff (earliest eligible item)
    {
      name: 'returnsAcceptedThrough',
      type: 'date',
      access: { update: ({ req }) => isSuperAdmin(req.user) }
    },

    // bookkeeping
    {
      name: 'inventoryAdjustedAt',
      type: 'date',
      admin: { readOnly: true, description: 'Set when stock was decremented' },
      index: true,
      access: {
        create: () => false,
        update: () => false
      }
    },

    // ----- Shipment / Tracking (sellers can edit this) -----
    {
      type: 'group',
      name: 'shipment',
      access: { update: canEditShipment },
      hooks: { beforeChange: [beforeChangeShipment] },
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
