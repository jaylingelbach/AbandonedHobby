import { Media, Product, Tenant } from '@/payload-types';

export function isPopulatedTenant(value: Product['tenant']): value is Tenant {
  return !!value && typeof value === 'object' && 'slug' in value;
}

// Narrow the media relationship (upload)
function isMedia(value: unknown): value is Media {
  return (
    !!value && typeof value === 'object' && 'id' in (value as { id?: unknown })
  );
}

// Get a thumbnail URL from the product's first image (if present)
export function resolveThumbnailUrl(product: Product): string | undefined {
  const firstImage = product.images?.[0];
  if (!firstImage) return undefined;

  const image = firstImage.image;
  if (!image) return undefined;

  if (typeof image === 'string') {
    // Only an id, no populated doc – with depth: 1 this usually
    // shouldn't happen, but if it does we just skip the thumbnail.
    return undefined;
  }

  if (!isMedia(image)) {
    return undefined;
  }

  // Simplest and safest: use the main URL
  if (typeof image.url === 'string' && image.url.length > 0) {
    return image.url;
  }

  return undefined;
}
