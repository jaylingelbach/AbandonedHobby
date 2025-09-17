import { getBestUrlFromMedia } from '@/lib/utils';

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
