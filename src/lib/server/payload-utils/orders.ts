import type { Access, FieldAccess, FieldHook, Where } from 'payload';
import { isSuperAdmin } from '@/lib/access';

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
 * Extract tenant IDs from a user record, resilient to:
 * - `user.tenants: Array<{ id?: string }>`
 * - `user.tenants: Array<{ tenant?: string | { id?: string | null } }>`
 */
export function getTenantIdsFromUser(user: unknown): string[] {
  const candidate = user as
    | {
        tenants?: Array<{
          tenant?: string | { id?: string | null };
        }>;
      }
    | undefined;

  const entries = Array.isArray(candidate?.tenants) ? candidate!.tenants! : [];

  const ids = entries
    .map((entry) => {
      const relation = entry?.tenant;
      if (typeof relation === 'string') return relation;
      if (
        relation &&
        typeof relation === 'object' &&
        typeof relation.id === 'string'
      ) {
        return relation.id;
      }
      return null;
    })
    .filter((id): id is string => typeof id === 'string');

  return ids;
}

/**
 * Determine if a user is the seller for the given order document.
 * Primary check: `order.sellerTenant`, fallback to `order.product.tenant`.
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
 * Collection read access for Orders.
 * - Super-admins: full access
 * - Non-admins: buyer of the order OR seller by `sellerTenant` membership
 */
export const readOrdersAccess: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true;
  if (!user?.id) return false;

  const buyerScope: Where = { buyer: { equals: user.id } };

  const tenantIds = getTenantIdsFromUser(user);
  if (tenantIds.length > 0) {
    const sellerScope: Where = { sellerTenant: { in: tenantIds } };
    return { or: [buyerScope, sellerScope] };
  }
  return buyerScope;
};

/**
 * Collection update access for Orders.
 * - Super-admins: full access
 * - Sellers: can update orders where their tenant matches `sellerTenant`
 */
export const updateOrdersAccess: Access = ({ req }) => {
  if (isSuperAdmin(req.user)) return true;
  const tenantIds = getTenantIdsFromUser(req.user);
  if (tenantIds.length === 0) return false;
  return { sellerTenant: { in: tenantIds } };
};

/**
 * Field access: `shipment` group is editable by super-admins or matching sellers.
 */
export const canEditOrderShipment: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfOrderDoc(doc, req.user);

/**
 * Field access: `fulfillmentStatus` field is editable by super-admins or matching sellers.
 */
export const canEditOrderFulfillmentStatus: FieldAccess = ({ req, doc }) =>
  isSuperAdmin(req.user) || isSellerOfOrderDoc(doc, req.user);

/**
 * `beforeChange` hook for the `shipment` group.
 * IMPORTANT: For a field hook, return the group value itself.
 */
export const beforeChangeOrderShipment: FieldHook = async ({
  value,
  siblingData,
  req
}) => {
  // Skip for webhook/system writes to avoid unintended side-effects
  if (req?.context && (req.context as Record<string, unknown>)?.ahSystem) {
    return value;
  }

  const nextValue = { ...(value ?? {}) } as ShipmentGroup;

  const hasTrackingNumber =
    typeof nextValue.trackingNumber === 'string' &&
    nextValue.trackingNumber.trim().length > 0;

  if (hasTrackingNumber) {
    const carrier = nextValue.carrier;
    const trackingNumber = nextValue.trackingNumber ?? '';

    let trackingUrl = '';
    if (carrier === 'usps') {
      trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
    } else if (carrier === 'ups') {
      trackingUrl = `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(trackingNumber)}`;
    } else if (carrier === 'fedex') {
      trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
    }

    nextValue.trackingUrl = trackingUrl || undefined;

    const currentStatus: OrderStatus =
      (siblingData?.fulfillmentStatus as OrderStatus | undefined) ??
      'unfulfilled';
    if (currentStatus === 'unfulfilled') {
      (siblingData as OrderMutationShape).fulfillmentStatus = 'shipped';
    }

    if (!nextValue.shippedAt) {
      nextValue.shippedAt = new Date().toISOString();
    }
  } else {
    if (nextValue.trackingUrl) nextValue.trackingUrl = undefined;
    // Also clear shippedAt:
    nextValue.shippedAt = undefined;
  }

  return nextValue;
};
