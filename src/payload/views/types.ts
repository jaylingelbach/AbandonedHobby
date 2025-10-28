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

export type CountResult = number | { totalDocs: number };
