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
    .filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    );
  return Array.from(new Set(ids));
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
 * Canonicalize tracking numbers:
 * - trim
 * - remove spaces and dash-like characters
 * - uppercase (helps UPS formats like "1z")
 */

function normalizeTrackingServer(raw: unknown): string {
  const value = typeof raw === 'string' ? raw : '';
  return value
    .trim()
    .replace(/[\s\u2010-\u2015-]+/g, '')
    .toUpperCase();
}

function normalizeCarrier(input: unknown): ShipmentGroup['carrier'] {
  if (typeof input !== 'string') return undefined;
  const value = input.trim().toLowerCase();
  if (value.length === 0) return undefined;
  if (
    value === 'usps' ||
    value === 'ups' ||
    value === 'fedex' ||
    value === 'other'
  ) {
    return value;
  }
}

/** Carrier-specific heuristic regexes (server-side validation). */
const serverPatterns: Record<
  NonNullable<ShipmentGroup['carrier']>,
  RegExp[]
> = {
  usps: [
    /^(?:\d{20}|\d{22}|\d{26}|\d{30}|\d{34})$/, // IMpb common lengths
    /^[A-Z]{2}\d{9}[A-Z]{2}$/ // UPU S10 (e.g., EC123456789US)
  ],
  ups: [/^1Z[0-9A-Z]{16}$/], // 1Z + 16 alphanumerics
  fedex: [
    /^(?:\d{12}|\d{15}|\d{20}|\d{22})$/, // common FedEx lengths
    /^DT\d{12,14}$/ // Door tag
  ],
  other: [/^.{6,}$/] // minimal sanity check
};

function isLikelyValidTrackingServer(
  carrier: ShipmentGroup['carrier'],
  normalizedTrackingNumber: string
): boolean {
  if (!carrier) return false;
  const patterns = serverPatterns[carrier];
  return patterns.some((regex) => regex.test(normalizedTrackingNumber));
}

/** Build a public tracking URL for known carriers. */
function buildTrackingUrl(
  carrier: ShipmentGroup['carrier'],
  normalizedTrackingNumber: string
): string | undefined {
  if (!carrier || normalizedTrackingNumber.length === 0) return undefined;

  if (carrier === 'usps') {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(
      normalizedTrackingNumber
    )}`;
  }
  if (carrier === 'ups') {
    return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(
      normalizedTrackingNumber
    )}`;
  }
  if (carrier === 'fedex') {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(
      normalizedTrackingNumber
    )}`;
  }
  return undefined; // 'other' or unknown carriers
}

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

  // --- INPUT CLEANUP (write back) ------------------------------------------

  const normalizedCarrier = normalizeCarrier(nextValue.carrier);
  nextValue.carrier = normalizedCarrier;

  const normalizedTrackingNumber = normalizeTrackingServer(
    nextValue.trackingNumber
  );
  nextValue.trackingNumber = normalizedTrackingNumber || undefined;

  const hasCarrier =
    typeof normalizedCarrier === 'string' && normalizedCarrier.length > 0;
  const hasTrackingNumber = normalizedTrackingNumber.length > 0;

  // --- BASIC PAIR VALIDATION (friendly errors) -----------------------------
  if (hasCarrier && !hasTrackingNumber) {
    throw new Error(
      'A tracking number is required when a carrier is selected.'
    );
  }
  if (!hasCarrier && hasTrackingNumber) {
    throw new Error(
      'A carrier is required when a tracking number is provided.'
    );
  }

  // --- SHORT-CIRCUIT WHEN EMPTY (clear fields and possibly demote) ---------
  if (!hasCarrier && !hasTrackingNumber) {
    // clear derived fields if previously set
    nextValue.trackingUrl = undefined;
    nextValue.shippedAt = undefined;
    const currentStatus: OrderStatus =
      (siblingData?.fulfillmentStatus as OrderStatus | undefined) ??
      'unfulfilled';
    if (currentStatus === 'shipped') {
      // Demote only if your policy is that "no tracking" cannot remain "shipped".
      // This matches your current behavior.
      (siblingData as OrderMutationShape).fulfillmentStatus = 'unfulfilled';
    }
    return nextValue;
  }
  if (
    !isLikelyValidTrackingServer(normalizedCarrier, normalizedTrackingNumber)
  ) {
    const message =
      normalizedCarrier === 'usps'
        ? 'USPS tracking should be 20/22/26/30/34 digits or an S10 code like EC123456789US.'
        : normalizedCarrier === 'ups'
          ? 'UPS tracking should match 1Z + 16 letters/digits (e.g., 1Z999AA10123456784).'
          : normalizedCarrier === 'fedex'
            ? 'FedEx tracking should be 12/15/20/22 digits or a door tag like DT123456789012.'
            : 'Tracking looks too short—please enter at least 6 characters.';
    throw new Error(message);
  }

  // --- DERIVED FIELDS + STATUS TRANSITIONS --------------------------------
  nextValue.trackingUrl = buildTrackingUrl(
    normalizedCarrier,
    normalizedTrackingNumber
  );

  const currentStatus: OrderStatus =
    (siblingData?.fulfillmentStatus as OrderStatus | undefined) ??
    'unfulfilled';
  if (currentStatus === 'unfulfilled') {
    (siblingData as OrderMutationShape).fulfillmentStatus = 'shipped';
  }

  if (!nextValue.shippedAt) {
    nextValue.shippedAt = new Date().toISOString();
  }

  return nextValue;
};
