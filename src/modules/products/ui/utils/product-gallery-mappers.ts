import { isObjectRecord } from '@/lib/utils';

export interface PayloadMediaDoc {
  id?: string;
  url?: string;
  alt?: string;
  sizes?: {
    thumbnail?: { url?: string };
    medium?: { url?: string };
  };
}

export interface ProductImagesFieldItem {
  image?: string | PayloadMediaDoc;
  alt?: string;
}

export interface MappedGalleryItem {
  url: string;
  alt?: string;
}

/**
 * Type guard that checks whether a value resembles a PayloadMediaDoc.
 *
 * A value is considered a media doc if it is an object record and has an `id` property.
 */
function isMediaDoc(value: unknown): value is PayloadMediaDoc {
  return isObjectRecord(value) && 'id' in value;
}

/**
 * Map a raw Payload `products.images` field to gallery items, safely handling unknown input.
 *
 * Returns an array of objects with a usable image `url` and optional `alt`. Non-array input,
 * non-object rows, image IDs (string), or media entries without a resolvable URL are skipped.
 *
 * @param imagesInput - Raw value from a product's `images` field (may be any depth or unknown).
 * @param preferredSize - Which size to prefer when picking a URL: `medium` (default), `thumbnail`, or `original`.
 *   - `medium`: uses `media.sizes?.medium?.url` then falls back to `media.url`
 *   - `thumbnail`: uses `media.sizes?.thumbnail?.url` then falls back to `media.url`
 *   - `original`: uses `media.url`
 * @returns An array of MappedGalleryItem with `{ url, alt? }` for each media that yielded a URL.
 */
export function mapProductImagesFromPayload(
  imagesInput: unknown,
  preferredSize: 'medium' | 'thumbnail' | 'original' = 'medium'
): MappedGalleryItem[] {
  if (!Array.isArray(imagesInput)) return [];

  const out: MappedGalleryItem[] = [];

  for (const row of imagesInput) {
    if (!isObjectRecord(row)) continue;

    const imageValue = (row as { image?: unknown }).image;
    const altFromRow = (row as { alt?: unknown }).alt;

    // If depth=0, this might be a string ID — skip (no URL to render).
    if (typeof imageValue === 'string') continue;

    if (!isMediaDoc(imageValue)) continue;

    const media = imageValue;
    const url =
      preferredSize === 'medium'
        ? (media.sizes?.medium?.url ?? media.url ?? undefined)
        : preferredSize === 'thumbnail'
          ? (media.sizes?.thumbnail?.url ?? media.url ?? undefined)
          : (media.url ?? undefined);

    if (!url) continue;

    const alt =
      (typeof altFromRow === 'string' ? altFromRow : undefined) ??
      (typeof media.alt === 'string' ? media.alt : undefined);

    out.push({ url, alt });
  }

  return out;
}
