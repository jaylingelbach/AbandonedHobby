export type OrderSummaryDTO = {
  orderId: string;
  orderNumber: string;
  orderDateISO: string; // createdAt
  returnsAcceptedThroughISO: string | null;
  currency: string;
  totalCents: number;
  quantity: number; // sum of item quantities
  productId: string;
};
