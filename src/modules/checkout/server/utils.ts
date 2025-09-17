export type MediaLike = {
  url?: string | null;
  sizes?: {
    medium?: { url?: string | null };
    thumbnail?: { url?: string | null };
  };
};

/**
 * Returns the best available image URL from a media-like object, preferring a sized variant when present.
 *
 * If `media` is falsy or not an object, `undefined` is returned. Behavior by `preferred`:
 * - `'medium'`: return `sizes.medium.url` if present, otherwise `url`.
 * - `'thumbnail'`: return `sizes.thumbnail.url` if present, otherwise `url`.
 * - `'original'`: return `url`.
 *
 * @param media - The media-like value to resolve (expected shape matches `MediaLike`).
 * @param preferred - Which size to prefer when available; defaults to `'medium'`.
 * @returns The resolved URL string, or `undefined` if no suitable URL is found.
 */
export function getBestUrlFromMedia(
  media: unknown,
  preferred: 'medium' | 'thumbnail' | 'original' = 'medium'
): string | undefined {
  if (!media || typeof media !== 'object') return undefined;
  const m = media as MediaLike;
  if (preferred === 'medium') return m.sizes?.medium?.url ?? m.url ?? undefined;
  if (preferred === 'thumbnail')
    return m.sizes?.thumbnail?.url ?? m.url ?? undefined;
  return m.url ?? undefined;
}

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
