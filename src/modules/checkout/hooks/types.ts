export type TenantCartSummary = {
  tenantKey: string;
  productIds: string[];
  quantitiesByProductId: Record<string, number>;
};
