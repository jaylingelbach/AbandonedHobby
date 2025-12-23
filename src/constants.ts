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

// UI fallback for unnamed tenants and changing the literal may affect conditional rendering elsewhere. UI fallback for unnamed tenants and that changing the literal may affect conditional rendering elsewhere.
export const FALLBACK_TENANT_NAME = 'An Abandoned Hobby Shop';

export const CART_QUERY_LIMIT = 50;

export const moderationFlagReasons = [
  'spam',
  'scam_or_fraud',
  'inappropriate_or_nsfw',
  'prohibited_item',
  'misleading_or_false',
  'copyright_or_ip',
  'duplicate_listing',
  'other'
] as const;

export type FlagReasons = (typeof moderationFlagReasons)[number];

export const flagReasonLabels: Record<FlagReasons, string> = {
  spam: 'Spam or advertising',
  scam_or_fraud: 'Scam or fraudulent activity',
  inappropriate_or_nsfw: 'Inappropriate or NSFW content',
  prohibited_item: 'Prohibited or restricted item',
  misleading_or_false: 'Misleading or false information',
  copyright_or_ip: 'Copyright or intellectual property issue',
  duplicate_listing: 'Duplicate listing',
  other: 'Other (please specify)'
};

export const flagReasonLabelsEmail: Record<FlagReasons, string> = {
  spam: 'classified as spam or unwanted advertising',
  scam_or_fraud: 'identified as a potential scam or fraudulent listing',
  inappropriate_or_nsfw: 'containing inappropriate or NSFW content',
  prohibited_item: 'offering an item that isn’t allowed on our marketplace',
  misleading_or_false: 'containing misleading or inaccurate information',
  copyright_or_ip: 'raising copyright or intellectual property concerns',
  duplicate_listing: 'duplicating another listing on the marketplace',
  other: 'not meeting our marketplace guidelines'
};
