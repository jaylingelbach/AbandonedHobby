export type MediaLike = {
  url?: string | null;
  sizes?: {
    medium?: { url?: string | null };
    thumbnail?: { url?: string | null };
  };
};

/** Prefer a sized URL when available, else fall back to original. */
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

/** Choose a single card image: cover first, else first gallery image. */
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
