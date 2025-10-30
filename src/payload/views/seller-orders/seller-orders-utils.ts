import type { AdminViewServerProps, Where } from 'payload';
import { buildSellerOrdersWhere } from '@/modules/orders/server/utils'; // ← your util
import type { GetInput, SellerOrderRow } from '../types';

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
        ? searchParams.from
        : undefined,
    toISO:
      typeof searchParams?.to === 'string' && searchParams.to.length > 0
        ? searchParams.to
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
    buyerEmail:
      typeof doc.buyerEmail === 'string'
        ? doc.buyerEmail
        : (doc.buyerEmail ?? null),
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
