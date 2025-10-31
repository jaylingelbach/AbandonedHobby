import type { AdminViewServerProps, Where } from 'payload';
import { buildSellerOrdersWhere } from '@/modules/orders/server/utils';
import type { GetInput, SellerOrderRow } from '../types';

/**
 * Determines whether a string represents a valid ISO date in `YYYY-MM-DD` form (optionally with time) and matches the parsed Date.
 *
 * @param dateString - The input date string to validate (expected `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS...`).
 * @returns `true` if `dateString` contains a valid `YYYY-MM-DD` date part that parses to a real date and matches the parsed Date's ISO date, `false` otherwise.
 */
function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  const datePart = dateString.split('T')[0];
  return (
    !isNaN(date.getTime()) &&
    datePart !== undefined &&
    date.toISOString().startsWith(datePart) &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/.test(datePart)
  );
}

/**
 * Fetches and normalizes paginated seller order rows using request search parameters and the current user's tenant.
 *
 * Parses paging and filter values from `props.initPageResult.req` searchParams, validates and normalizes them, queries the `orders` collection, and maps results to `SellerOrderRow` objects.
 *
 * @param props - Server view props containing the initial page result and request search parameters
 * @returns An object containing `items` (the transformed seller order rows), `page` (current page), `totalPages`, and `pageSize`
 * @throws Error if a tenant ID cannot be resolved from the current user
 */
export async function getSellerOrdersData(
  props: AdminViewServerProps
): Promise<{
  items: SellerOrderRow[];
  page: number;
  totalPages: number;
  pageSize: number;
}> {
  const { initPageResult, searchParams } = props;
  const request = initPageResult.req;
  const payload = request.payload;

  // Resolve tenant from the current user
  const userTenants =
    (
      request.user as
        | { tenants?: Array<{ tenant?: { id?: string } | string }> }
        | undefined
    )?.tenants ?? [];
  const tenantId =
    (typeof userTenants[0]?.tenant === 'object'
      ? userTenants[0]?.tenant?.id
      : (userTenants[0]?.tenant as string | undefined)) ?? '';

  if (!tenantId) {
    throw new Error(
      'Tenant ID is required but could not be resolved from the current user'
    );
  }

  // Basic query params (GET) for paging & filters
  const page = Number(searchParams?.page ?? 1);
  const pageSize = Number(searchParams?.pageSize ?? 25);

  const input: GetInput = {
    tenantId,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100
        ? pageSize
        : 25,
    query:
      typeof searchParams?.q === 'string' && searchParams.q.trim() !== ''
        ? searchParams.q
        : undefined,
    status:
      typeof searchParams?.status === 'string' &&
      ['unfulfilled', 'shipped', 'delivered', 'returned'].includes(
        searchParams.status
      )
        ? ([searchParams.status] as GetInput['status'])
        : undefined,
    hasTracking:
      searchParams?.hasTracking === 'yes' || searchParams?.hasTracking === 'no'
        ? (searchParams.hasTracking as 'yes' | 'no')
        : undefined,
    fromISO:
      typeof searchParams?.from === 'string' && searchParams.from.length > 0
        ? isValidISODate(searchParams.from)
          ? searchParams.from
          : undefined
        : undefined,
    toISO:
      typeof searchParams?.to === 'string' && searchParams.to.length > 0
        ? isValidISODate(searchParams.to)
          ? searchParams.to
          : undefined
        : undefined,
    sort:
      searchParams?.sort === 'createdAtAsc' ? 'createdAtAsc' : 'createdAtDesc'
  };

  // Build typed Where with your util (uses greater_than_equal / less_than_equal)
  const where: Where = buildSellerOrdersWhere(input);

  const sort = input.sort === 'createdAtAsc' ? 'createdAt' : '-createdAt';

  const result = await payload.find({
    collection: 'orders',
    where,
    sort,
    depth: 0,
    pagination: true,
    page: input.page,
    limit: input.pageSize
    // NOTE: Do NOT use overrideAccess here so your Orders access rules still apply.
  });

  type RawRow = {
    id: string;
    orderNumber?: string | null;
    createdAt: string;
    buyerEmail?: string | null;
    total?: number | null;
    currency?: string | null;
    fulfillmentStatus?:
      | 'unfulfilled'
      | 'shipped'
      | 'delivered'
      | 'returned'
      | null;
    shipment?: {
      carrier?: 'usps' | 'ups' | 'fedex' | 'other';
      trackingNumber?: string | null;
    } | null;
    items?: unknown[] | null;
  };

  const items: SellerOrderRow[] = (result.docs as RawRow[]).map((doc) => ({
    id: String(doc.id),
    orderNumber:
      typeof doc.orderNumber === 'string' ? doc.orderNumber : String(doc.id),
    createdAtISO: doc.createdAt,
    buyerEmail: doc.buyerEmail ?? null,
    itemCount: Array.isArray(doc.items) ? doc.items.length : 0,
    totalCents: typeof doc.total === 'number' ? doc.total : 0,
    currency: doc.currency ?? 'USD',
    status: (doc.fulfillmentStatus ??
      'unfulfilled') as SellerOrderRow['status'],
    carrier: doc.shipment?.carrier ?? undefined,
    trackingNumber: doc.shipment?.trackingNumber?.trim() || undefined
  }));

  return {
    items,
    page: (result as { page?: number }).page ?? input.page,
    totalPages: (result as { totalPages?: number }).totalPages ?? 1,
    pageSize: input.pageSize
  };
}
