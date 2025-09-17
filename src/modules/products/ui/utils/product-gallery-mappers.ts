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

/** Type guard: does this look like a populated Payload Media doc? */
function isMediaDoc(value: unknown): value is PayloadMediaDoc {
  return isObjectRecord(value) && 'id' in value;
}

/**
 * Safely map a Payload `products.images` field (at any depth) to gallery items.
 * Accepts `unknown` so you can pass `data.images` directly without fussy casting.
 *
 * - If a row's `image` is an ID (string) because of low depth, it's skipped.
 * - Prefers the `medium` size URL when available, falls back to original `url`.
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
