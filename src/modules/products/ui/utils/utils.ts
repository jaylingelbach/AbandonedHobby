import { isObjectRecord, getBestUrlFromMedia } from '@/lib/utils';

/**
 * Returns the best-available card image URL for a product, preferring the product cover.
 *
 * Cover for products is now legacy
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

// Safely read tenant slug from union type (string | object)
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

// Safely read tenant image URL from union type (string | object)
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
