import { isObjectRecord } from '@/lib/utils';
import { Media } from '@/payload-types';

function isMediaDoc(v: unknown): v is Media {
  return isObjectRecord(v) && typeof (v as { id?: unknown }).id === 'string';
}

/** Prefer cover (if populated), else first populated images[].image; else null. */
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
