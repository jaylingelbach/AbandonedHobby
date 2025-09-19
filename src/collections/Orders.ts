import { isSuperAdmin } from '@/lib/access';
import type {
  Access,
  CollectionConfig,
  FieldAccess,
  FieldHook,
  Where
} from 'payload';

/* ---------------------------------
   Helpers
----------------------------------*/
function getTenantIdsFromUser(user: unknown): string[] {
  const u = user as { tenants?: Array<{ id: string }> } | undefined;
  return Array.isArray(u?.tenants) ? u.tenants.map((t) => t.id) : [];
}

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

/* ---------------------------------
   Collection-level access
   (boolean | Where are valid Access returns)
----------------------------------*/
const readAccess: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) return true;
  const tenantIds = getTenantIdsFromUser(req.user);
  if (!tenantIds.length) return false;
  const where: Where = { sellerTenant: { in: tenantIds } };
  return where;
};

const updateAccess: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) return true;
  const tenantIds = getTenantIdsFromUser(req.user);
  if (!tenantIds.length) return false;
  const where: Where = { sellerTenant: { in: tenantIds } };
  return where;
};

/* ---------------------------------
   Field access
----------------------------------*/
const canEditShipment: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfDoc(doc, req.user);

const canEditFulfillmentStatus: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfDoc(doc, req.user);

/* ---------------------------------
   Hooks
----------------------------------*/
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

    // Auto-bump status + timestamp if they add tracking
    if (data.fulfillmentStatus === 'unfulfilled') {
      data.fulfillmentStatus = 'shipped';
    }
    if (!data.shipment.shippedAt) {
      data.shipment.shippedAt = new Date().toISOString();
    }
  }

  return data;
};

/* ---------------------------------
   Collection
----------------------------------*/
export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: readAccess,
    create: ({ req }) => isSuperAdmin(req.user),
    update: updateAccess,
    delete: ({ req }) => isSuperAdmin(req.user)
  },
  admin: {
    // ⬅️ back to your original title
    useAsTitle: 'name'
  },
  fields: [
    // ----- Your original fields (unchanged) -----
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
        description: 'The Stripe account associated with the order. '
      }
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        description: 'The Stripe checkout session associated with the order. '
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
    { name: 'buyerEmail', type: 'email' },
    { name: 'currency', type: 'text', required: true },
    { name: 'stripePaymentIntentId', type: 'text', index: true },
    { name: 'stripeChargeId', type: 'text', index: true },

    // original "shipping" address group (kept as-is)
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

    // line items w/ quantity
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

    // order-level returns cutoff (earliest eligible item)
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

    // ----- Added: fulfillment status (seller can update) -----
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

    // ----- Added: shipment tracking (seller can update) -----
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
