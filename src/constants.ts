export const DEFAULT_LIMIT = 8;
export const PLATFORM_FEE_PERCENTAGE = 10;
export const DECIMAL_PLATFORM_PERCENTAGE = PLATFORM_FEE_PERCENTAGE / 100;

export const carriers = ['usps', 'ups', 'fedex', 'other'] as const;
export type Carrier = (typeof carriers)[number];
export const carrierLabels: Record<Carrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  other: 'Other'
};

export const STRIPE_METADATA_MAX_LENGTH = 500 as const;

export const CART_SESSION_COOKIE = 'ah_cart_session';
export const DEVICE_ID_COOKIE = 'ah_device_id';

export const FALLBACK_TENANT_NAME = 'An Abandoned Hobby Shop';
