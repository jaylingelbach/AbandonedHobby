import { isObjectRecord } from '@/lib/utils';

// Prefer "medium" if available
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
export function getTenantSlug(product: unknown): string | undefined {
  if (!isObjectRecord(product)) return undefined;
  const tenant = product.tenant as unknown;
  if (typeof tenant === 'string') return undefined;
  if (isObjectRecord(tenant) && typeof tenant.slug === 'string')
    return tenant.slug;
  return undefined;
}

// Safely read tenant image URL from union type (string | object)
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
