import {
  OrderForInvoice,
  OrderItemCore,
  ShippingAddress
} from '@/domain/orders/types';

export type OrderItemDoc = Pick<
  OrderItemCore,
  'nameSnapshot' | 'quantity' | 'unitAmount' | 'amountTotal'
>;

export type OrderDoc = OrderForInvoice; // ← unify name in this module

// If you referenced ShippingAddress here before, re-export it:
export type { ShippingAddress };
