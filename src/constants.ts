export const DEFAULT_LIMIT = 8;
export const PLATFORM_FEE_PERCENTAGE = 10;

export const carriers = ['usps', 'ups', 'fedex', 'other'] as const;
export type Carrier = (typeof carriers)[number];
export const carrierLabels: Record<Carrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  other: 'Other'
};
