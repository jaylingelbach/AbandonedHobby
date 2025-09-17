import { isObjectRecord } from '@/lib/utils';

/**
 * Selects the best available URL from a media-like object, preferring a specified size.
 *
 * Attempts to return a size-specific URL (medium or thumbnail) when present, falling back to the top-level
 * `url` property if the preferred size is missing. If `preferred` is `original`, only the top-level `url`
 * is considered. Returns `undefined` when `media` is falsy or no URL is available.
 *
 * @param media - A media-like object which may have a top-level `url` and an optional `sizes` object
 *   with `medium` and `thumbnail` entries containing `url` fields.
 * @param preferred - Which URL size to prefer: `'medium'` (default), `'thumbnail'`, or `'original'`.
 * @returns The selected URL string, or `undefined` if none is available.
 */
function getBestUrlFromMedia(
  media: unknown,
  preferred: 'medium' | 'thumbnail' | 'original' = 'medium'
): string | undefined {
  if (!media || typeof media !== 'object') return undefined;
  const m = media as {
    url?: string | null;
    alt?: string | null;
    sizes?: {
      medium?: { url?: string | null };
      thumbnail?: { url?: string | null };
    };
  };
  if (preferred === 'medium') return m.sizes?.medium?.url ?? m.url ?? undefined;
  if (preferred === 'thumbnail')
    return m.sizes?.thumbnail?.url ?? m.url ?? undefined;
  return m.url ?? undefined;
}

/**
 * Returns the best-available card image URL for a product, preferring the product cover.
 *
 * Attempts to resolve a medium-sized URL from `product.cover`. If none is found, looks for the
 * first entry in `product.images` that has an `image` object and returns its medium-sized URL.
 * Returns `undefined` if `product` is not an object or no suitable image URL can be found.
 *
 * @param product - The product-like value to read image data from; may be any type.
 * @returns A resolved image URL string or `undefined` when unavailable.
 */
export function getCardImageURL(product: unknown): string | undefined {
  if (!isObjectRecord(product)) return undefined;
  const coverUrl = getBestUrlFromMedia(product.cover, 'medium');
  if (coverUrl) return coverUrl;

  const images = product.images;
  if (Array.isArray(images)) {
    const first = images.find((row) => isObjectRecord(row) && row.image);
    if (first && isObjectRecord(first)) {
      return getBestUrlFromMedia(first.image, 'medium');
    }
  }
  return undefined;
}

/**
 * Returns the tenant slug from a product when `tenant` is an object.
 *
 * Safely handles cases where `product` is not an object record or `tenant` is a string. If `tenant.slug` exists and is a string, that value is returned; otherwise `undefined` is returned.
 *
 * @param product - The value to inspect for a tenant (may be any type).
 * @returns The tenant's `slug` string when available; otherwise `undefined`.
 */
export function getTenantSlug(product: unknown): string | undefined {
  if (!isObjectRecord(product)) return undefined;
  const tenant = product.tenant as unknown;
  if (typeof tenant === 'string') return undefined;
  if (isObjectRecord(tenant) && typeof tenant.slug === 'string')
    return tenant.slug;
  return undefined;
}

/**
 * Returns the tenant's thumbnail image URL from a product-like object, if available.
 *
 * Safely handles cases where `product` is not an object or `product.tenant` is a string. If `tenant`
 * is an object and contains an `image` media object, the function returns the best thumbnail URL
 * using `getBestUrlFromMedia`; otherwise it returns `undefined`.
 *
 * @param product - The value expected to be a product-like record containing an optional `tenant`.
 * @returns The tenant image thumbnail URL, or `undefined` when not present or not retrievable.
 */
export function getTenantImageURL(product: unknown): string | undefined {
  if (!isObjectRecord(product)) return undefined;
  const tenant = product.tenant as unknown;
  if (typeof tenant === 'string') return undefined;
  if (isObjectRecord(tenant)) {
    return getBestUrlFromMedia(tenant.image, 'thumbnail');
  }
  return undefined;
}
// ---------- end helpers ----------
