import type { Access, FieldAccess, FieldHook, Where } from 'payload';
import { isSuperAdmin } from '@/lib/access';

/** Minimal role-bearing shape we care about. */
type MaybeRoleUser = { roles?: unknown };

/** Order status union used in our hooks. */
type OrderStatus = 'unfulfilled' | 'shipped' | 'delivered' | 'returned';

/** Shipment sub-shape we mutate in the hook. */
type ShipmentShape = {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
};

type ShipmentGroup = {
  carrier?: 'usps' | 'ups' | 'fedex' | 'other';
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
};

/** Mutation shape we touch inside beforeChange hook. */
type OrderMutationShape = {
  shipment?: ShipmentShape;
  fulfillmentStatus?: OrderStatus;
};

/**
 * @description Extract tenant IDs from a user record, resilient to different relationship shapes.
 * Supports:
 * - `user.tenants: Array<{ id?: string }>`
 * - `user.tenants: Array<{ tenant?: string | { id?: string | null } }>`
 * @param {unknown} user - The user object from `req.user`.
 * @returns {string[]} Tenant IDs the user belongs to (empty if none).
 * @example
 * getTenantIdsFromUser({ tenants: [{ id: 't1' }, { tenant: { id: 't2' } }] })
 * // -> ['t1', 't2']
 */
export function getTenantIdsFromUser(user: unknown): string[] {
  const candidate = user as
    | {
        tenants?: Array<{
          id?: string;
          tenant?: string | { id?: string | null };
        }>;
      }
    | undefined;

  const entries =
    candidate && Array.isArray(candidate.tenants) ? candidate.tenants : [];

  const ids = entries
    .map((entry) => {
      if (typeof entry?.id === 'string') return entry.id;

      const rel = entry?.tenant as string | { id?: string | null } | undefined;
      if (typeof rel === 'string') return rel;
      if (rel && typeof rel.id === 'string') return rel.id;

      return null;
    })
    .filter((value): value is string => typeof value === 'string');

  return ids;
}

/**
 * @description Determine if a user is a seller for the given order document.
 * Primary check: `order.sellerTenant`
 * Fallback check: `order.product.tenant` when `sellerTenant` is missing.
 * @param {unknown} documentValue - Raw order doc (from access/hooks).
 * @param {unknown} user - Value from `req.user`.
 * @returns {boolean} True if user's tenant set includes the order's seller tenant.
 * @example
 * isSellerOfOrderDoc({ sellerTenant: { id: 't1' } }, { tenants: [{ tenant: 't1' }] })
 * // -> true
 */
export function isSellerOfOrderDoc(
  documentValue: unknown,
  user: unknown
): boolean {
  const tenantIds = getTenantIdsFromUser(user);
  if (tenantIds.length === 0) return false;

  const orderDoc = documentValue as
    | {
        sellerTenant?: string | { id?: string };
        product?:
          | string
          | {
              tenant?: string | { id?: string };
            };
      }
    | null
    | undefined;

  const sellerTenantRel = orderDoc?.sellerTenant;
  let targetTenantId =
    typeof sellerTenantRel === 'string' ? sellerTenantRel : sellerTenantRel?.id;

  if (!targetTenantId) {
    const productRel = orderDoc?.product;
    const productTenantRel =
      typeof productRel === 'string' ? undefined : productRel?.tenant;
    targetTenantId =
      typeof productTenantRel === 'string'
        ? productTenantRel
        : productTenantRel?.id;
  }

  return !!targetTenantId && tenantIds.includes(targetTenantId);
}

/**
 * @description Collection read access for Orders.
 * Super-admins: full access. Sellers: restricted to orders whose `sellerTenant` is in their tenant set.
 * Returns boolean for allow/deny, or a `Where` filter to scope results.
 * @param {{ req: { user?: unknown } }} ctx - Payload access args (only `req.user` is used).
 * @returns {boolean | Where} `true` (super-admin), `false` (no access), or tenant filter.
 */
export const readOrdersAccess: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true;

  const tenantIds = getTenantIdsFromUser(user);
  if (tenantIds.length === 0) return false;

  const where: Where = { sellerTenant: { in: tenantIds } };
  return where;
};

/**
 * @description Collection update access for Orders.
 * Super-admins: full access. Sellers: can update their tenant orders.
 * Returns boolean or a `Where` filter.
 * @param {{ req: { user?: unknown } }} ctx - Payload access args (only `req.user` is used).
 * @returns {boolean | Where} `true` (super-admin), `false`, or tenant filter.
 */
export const updateOrdersAccess: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) return true;

  const tenantIds = getTenantIdsFromUser(req.user);
  if (tenantIds.length === 0) return false;

  const where: Where = { sellerTenant: { in: tenantIds } };
  return where;
};

/**
 * @description Field-level access for the `shipment` group.
 * Editable by super-admins or sellers that own the order's seller tenant.
 * @param {{ req: { user?: unknown }, doc: unknown }} ctx - Payload field access args.
 * @returns {boolean} Whether the current user may edit the `shipment` group.
 */
export const canEditOrderShipment: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfOrderDoc(doc, req.user);

/**
 * @description Field-level access for the `fulfillmentStatus` field.
 * Editable by super-admins or matching sellers.
 * @param {{ req: { user?: unknown }, doc: unknown }} ctx - Payload field access args.
 * @returns {boolean} Whether the current user may edit `fulfillmentStatus`.
 */
export const canEditOrderFulfillmentStatus: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfOrderDoc(doc, req.user);

/**
 * @description `beforeChange` hook for the `shipment` group.
 * IMPORTANT: For a field hook, RETURN THE FIELD VALUE (the group), not the entire doc.
 */
export const beforeChangeOrderShipment: FieldHook = async ({
  value, // <-- the current value of the `shipment` group (this is what we must return)
  siblingData, // the rest of the doc’s values at the same level (you can mutate this)
  req
}) => {
  // Skip for webhook/system writes to avoid unintended side-effects & recursion paths
  if (req?.context && (req.context as Record<string, unknown>)?.ahSystem) {
    return value;
  }

  const v = { ...(value ?? {}) } as ShipmentGroup;

  const hasTrackingNumber =
    typeof v.trackingNumber === 'string' && v.trackingNumber.trim().length > 0;

  if (hasTrackingNumber) {
    const carrier = v.carrier;
    const trackingNumber = v.trackingNumber ?? '';

    let trackingUrl = '';
    if (carrier === 'usps') {
      trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
    } else if (carrier === 'ups') {
      trackingUrl = `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(trackingNumber)}`;
    } else if (carrier === 'fedex') {
      trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
    }

    // Write back to the group value (the field)
    if (trackingUrl) {
      v.trackingUrl = trackingUrl;
    } else if (v.trackingUrl) {
      v.trackingUrl = undefined;
    }

    // Bump fulfillmentStatus (this lives in the parent object → siblingData)
    const currentStatus: OrderStatus =
      (siblingData?.fulfillmentStatus as OrderStatus | undefined) ??
      'unfulfilled';
    if (currentStatus === 'unfulfilled') {
      (siblingData as OrderMutationShape).fulfillmentStatus = 'shipped';
    }

    // Set shippedAt if missing (on the group)
    if (!v.shippedAt) {
      v.shippedAt = new Date().toISOString();
    }
  } else {
    // No tracking number: clear derived trackingUrl only (preserve shippedAt)
    if (v.trackingUrl && !v.trackingNumber) {
      v.trackingUrl = undefined;
    }
  }

  // RETURN THE GROUP VALUE, not args.data
  return v;
};
