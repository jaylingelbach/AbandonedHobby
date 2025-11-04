// src/modules/shipping/quote.ts
export type ShippingMode = 'free' | 'flat' | 'calculated';

export interface OrderItemForQuote {
  shippingMode?: ShippingMode;
  shippingSubtotalCents?: number;
  quantity?: number;
}

export interface AddressShape {
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

export interface ShippingQuote {
  totalCents: number;
  provider?: 'stub' | 'usps' | 'ups' | 'fedex' | 'easypost' | 'shippo';
  serviceName?: string;
}

export async function quoteCalculatedShipping(
  items: OrderItemForQuote[],
  destination?: AddressShape
): Promise<ShippingQuote> {
  // MVP: $0.00 so “calculated” doesn’t block checkout.
  // Replace with real carrier API later.
  return { totalCents: 0, provider: 'stub' };
}
