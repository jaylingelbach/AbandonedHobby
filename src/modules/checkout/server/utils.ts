import { z } from 'zod';
import { usdToCents } from '@/lib/money';
import { getBestUrlFromMedia } from '@/lib/utils';
import { STRIPE_METADATA_MAX_LENGTH } from '@/constants';

export type MediaLike = {
  url?: string | null;
  sizes?: {
    medium?: { url?: string | null };
    thumbnail?: { url?: string | null };
  };
};

/** Choose a single card image: cover first, else first gallery image. */
/**
 * Selects a single card image URL for a product.
 *
 * Cover for products is now legacy
 * Prefers the product's cover image (medium size) and falls back to the first gallery image's medium URL.
 * Returns undefined if `product` is not an object or no suitable URL is found.
 *
 * @param product - Product-like object that may contain `cover` and an `images` array of `{ image }` entries.
 * @returns The resolved medium-size image URL, or `undefined` if none is available.
 */

export function getPrimaryCardImageUrl(product: unknown): string | undefined {
  if (!product || typeof product !== 'object') return undefined;
  const p = product as {
    cover?: unknown;
    images?: Array<{ image?: unknown | null }> | null;
  };

  // Prefer cover (use medium for cards; switch to thumbnail if you like)
  const fromCover = getBestUrlFromMedia(p.cover, 'medium');
  if (fromCover) return fromCover;

  // Fallback: first gallery image
  const first = Array.isArray(p.images)
    ? p.images.find((row) => row?.image)
    : undefined;
  return getBestUrlFromMedia(first?.image, 'medium');
}
export type ProductForShipping = {
  id: string;
  shippingMode?: 'free' | 'flat' | 'calculated' | null;
  shippingFlatFee?: number | null; // USD as number in your schema
};
/**
 * Computes a single Checkout-level fixed shipping amount for a cart.
 * Returns { shippingCents, hasCalculated }. If hasCalculated is true, you should
 * NOT add a fixed shipping option to the Session.
 */
export function computeFlatShippingCentsForCart(
  products: ProductForShipping[],
  quantityByProductId?: Map<string, number>
): { shippingCents: number; hasCalculated: boolean } {
  let shippingCents = 0;
  let hasCalculated = false;

  for (const product of products) {
    const mode = product.shippingMode ?? 'free';

    if (mode === 'flat') {
      let quantity: number;

      if (quantityByProductId) {
        const raw = quantityByProductId.get(product.id) ?? 0;
        quantity = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0;

        // If the map says 0 or invalid, skip this product
        if (quantity <= 0) continue;
      } else {
        // Preview / legacy behavior: one unit per product
        quantity = 1;
      }

      const perUnitCents = usdToCents(product.shippingFlatFee ?? 0, {
        allowNegative: false
      });

      // overflow protection for large quantities, unlikely to happen in practice.
      const lineShipping = perUnitCents * quantity;
      if (!Number.isSafeInteger(lineShipping)) {
        throw new Error('Shipping calculation exceeds safe integer range');
      }
      shippingCents += lineShipping;
    } else if (mode === 'calculated') {
      hasCalculated = true;
    }
  }

  return { shippingCents, hasCalculated };
}

/**
 * Convert a value to a string suitable for Stripe metadata and enforce the length limit.
 *
 * @param raw - The value to convert. If `null` or `undefined`, an empty string is produced; if a string, it is trimmed; otherwise `String(raw)` is used.
 * @returns The resulting string truncated to STRIPE_METADATA_MAX_LENGTH characters if necessary.
 */
export function truncateToStripeMetadata(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }

  const asString = typeof raw === 'string' ? raw.trim() : String(raw);

  if (asString.length <= STRIPE_METADATA_MAX_LENGTH) {
    return asString;
  }

  return asString.slice(0, STRIPE_METADATA_MAX_LENGTH);
}

export const productShippingSchema = z.object({
  shippingMode: z.enum(['free', 'flat', 'calculated']).nullable().optional(),
  shippingFlatFee: z.number().nullable().optional()
});

/**
 * Parse and validate shipping-related fields from a product object.
 *
 * @param product - The product to parse; must be an object with a non-empty string `id`. May include optional `shippingMode` and `shippingFlatFee` fields.
 * @returns The product's shipping data: `id`, `shippingMode` (one of `"free"`, `"flat"`, `"calculated"` or `null`), and `shippingFlatFee` (number in USD or `null`).
 * @throws Error if the product is missing an `id` property.
 * @throws Error if the product `id` is not a non-empty string.
 */
export function parseProductShipping(product: unknown): ProductForShipping {
  // Validate that product has a valid id
  if (!product || typeof product !== 'object' || !('id' in product)) {
    throw new Error('[checkout] Product missing id field');
  }
  const productId = (product as { id: unknown }).id;
  if (typeof productId !== 'string' || productId.trim() === '') {
    throw new Error('[checkout] Product id must be a non-empty string');
  }

  const parsed = productShippingSchema.safeParse(product);
  if (!parsed.success) {
    console.warn('[checkout] invalid/missing shipping fields', {
      productId,
      issues: parsed.error.issues
    });
  }

  return {
    id: productId,
    shippingMode: parsed.success ? (parsed.data.shippingMode ?? null) : null,
    shippingFlatFee: parsed.success
      ? (parsed.data.shippingFlatFee ?? null)
      : null
  };
}