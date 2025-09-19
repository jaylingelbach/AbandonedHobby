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

export type CountResult = number | { totalDocs: number };
