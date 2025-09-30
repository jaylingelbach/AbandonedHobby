import { ShippingAddress } from '@/modules/orders/types';

export type OrderItemDoc = {
  nameSnapshot?: string | null;
  quantity?: number | null; // positive int
  unitAmount?: number | null; // cents
  amountTotal?: number | null; // cents
};

export type OrderDoc = {
  id: string;
  orderNumber: string;
  createdAt: string;
  currency: string; // e.g., "USD"
  total: number; // cents
  items?: OrderItemDoc[];
  shipping?: ShippingAddress | null;
  returnsAcceptedThrough?: string | null;
  // sellerTenant?: string | {...} // not used for label here; see BRAND.name below
};
