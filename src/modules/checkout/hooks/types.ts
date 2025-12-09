export type TenantCartSummary = {
  tenantKey: string | null;
  productIds: string[];
  quantitiesByProductId: Record<string, number>;
};
