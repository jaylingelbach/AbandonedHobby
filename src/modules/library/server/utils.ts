import { isObjectRecord } from '@/lib/utils';
import { Media } from '@/payload-types';

/**
 * Type guard that asserts a value is a Media document.
 *
 * Returns true when `v` is an object-like record and has an `id` property of type `string`.
 *
 * @param v - Value to test
 * @returns `true` if `v` is a Media-like object (has a string `id`); otherwise `false`.
 */

function isMediaDoc(v: unknown): v is Media {
  return isObjectRecord(v) && typeof (v as { id?: unknown }).id === 'string';
}

/** Prefer cover (if populated), else first populated images[].image; else null. */
/**
 * Selects the primary Media for a product-like object.
 *
 * Cover for products is now legacy
 * Prefers `product.cover` if it is a Media document; otherwise returns the first
 * `images[]` entry whose `image` property is a Media document. If `product` is
 * not an object or no Media is found, returns `null`.
 *
 * @param product - The product-like value to inspect (any structure allowed)
 * @returns The chosen `Media` document, or `null` when none is available
 */

export function pickPrimaryMedia(product: unknown): Media | null {
  if (!isObjectRecord(product)) return null;

  const cover = (product as { cover?: unknown }).cover;
  if (isMediaDoc(cover)) return cover;

  const rows = (product as { images?: unknown }).images;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!isObjectRecord(row)) continue;
      const imageVal = (row as { image?: unknown }).image;
      if (isMediaDoc(imageVal)) return imageVal;
    }
  }
  return null;
}
