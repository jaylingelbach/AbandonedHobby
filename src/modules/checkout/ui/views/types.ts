export type TrpcErrorShape = { data?: { code?: string } };

export type CheckoutGroup = {
  products: Array<{ id: string; price: number }>;
  quantitiesByProductId: Record<string, number>;
};
