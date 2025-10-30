import { Carrier } from '@/constants';

export type CountSummary = {
  unfulfilledOrders: number;
  lowInventory: number;
  needsOnboarding: boolean;
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  totalCents: number;
  createdAt: string;
  fulfillmentStatus: 'unfulfilled' | 'shipped' | 'delivered' | 'returned';
};

export type BuyerCountSummary = {
  unfulfilledOrders: number;
  needsOnboarding: boolean;
};

export type BuyerDashboardCountSummary = {
  awaitingShipment: number;
  inTransit: number;
};

export type BuyerOrderListItem = {
  id: string;
  orderNumber: string;
  totalCents: number;
  createdAtISO: string;
  fulfillmentStatus: 'unfulfilled' | 'shipped' | 'delivered' | 'returned';
  carrier?: Carrier;
  trackingNumber?: string;
  shippedAtISO?: string;
};

export type SellerOrderRow = {
  id: string;
  orderNumber: string | null;
  createdAtISO: string;
  buyerEmail: string | null;
  itemCount: number;
  totalCents: number;
  currency: string;
  status: 'unfulfilled' | 'shipped' | 'delivered' | 'returned';
  carrier?: 'usps' | 'ups' | 'fedex' | 'other';
  trackingNumber?: string;
};

export type GetInput = {
  tenantId: string;
  page: number;
  pageSize: number;
  query?: string;
  status?:
    | Array<'unfulfilled' | 'shipped' | 'delivered' | 'returned'>
    | undefined;
  hasTracking?: 'yes' | 'no';
  fromISO?: string;
  toISO?: string;
  sort: 'createdAtDesc' | 'createdAtAsc';
};

export type CountResult = number | { totalDocs: number };
