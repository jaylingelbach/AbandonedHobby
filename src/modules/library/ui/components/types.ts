import { PublicAmountsDTO } from '@/modules/orders/types';

export type OrderItem = {
  id?: string;
  product?: string | { id?: string };
  nameSnapshot?: string;
  unitAmount?: number; // cents
  quantity?: number;
  amountSubtotal?: number; // cents
  amountTax?: number; // cents
  amountTotal?: number; // cents
  refundPolicy?: string;
  returnsAcceptedThrough?: string;
};

export type OrderForBuyer = {
  id: string;
  orderNumber: string;
  orderDateISO?: string;
  totalCents: number;
  currency?: string; // uppercase ISO, e.g. 'USD'
  quantity?: number;
  items?: OrderItem[];
  buyerEmail?: string | null;
  shipping?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  returnsAcceptedThroughISO?: string | null;
  amounts: PublicAmountsDTO;
};
