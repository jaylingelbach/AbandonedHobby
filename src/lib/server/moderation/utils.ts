import { Media, Product, Tenant } from '@/payload-types';
import { TRPCError } from '@trpc/server';

/**
 * Determines whether a Product.tenant value is a populated Tenant object.
 *
 * @param value - The tenant value to check
 * @returns `true` if `value` is a populated `Tenant` (object with a `slug`), `false` otherwise.
 */
export function isPopulatedTenant(value: Product['tenant']): value is Tenant {
  return !!value && typeof value === 'object' && 'slug' in value;
}

/**
 * Determines whether a value is a Media-like object that includes an `id` property.
 *
 * @returns `true` if `value` is a non-null object that has an `id` property, `false` otherwise.
 */
export function isMedia(value: unknown): value is Media {
  return (
    !!value && typeof value === 'object' && 'id' in (value as { id?: unknown })
  );
}

/**
 * Extracts a thumbnail URL from a product's first image when available.
 *
 * @param product - The product whose images will be inspected
 * @returns The first image's `url` if that image is a populated `Media` with a non-empty URL, `undefined` otherwise
 */
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

/**
 * Generates an RFC 4122 version 4 UUID.
 *
 * @returns A UUID string conforming to RFC 4122 version 4.
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Normalizes an optional note by trimming whitespace and treating empty or non-string values as absent.
 *
 * @param value - The input note to normalize.
 * @returns The trimmed note if it contains characters, `undefined` otherwise.
 */
export function normalizeOptionalNote(
  value: string | undefined
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validate and trim a required moderation note, enforcing a minimum length.
 *
 * @param value - The note text to validate and trim
 * @param minLength - Minimum allowed length in characters (defaults to 10)
 * @returns The trimmed note string
 * @throws TRPCError - `BAD_REQUEST` when the trimmed note is shorter than `minLength`
 */
export function normalizeRequiredNote(value: string, minLength = 10): string {
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Note must be at least ${minLength} characters.`
    });
  }
  return trimmed;
}

/**
 * Ensure the caller is an authenticated staff user with the `super-admin` or `support` role.
 *
 * @param user - Session user object that may include a `roles` array of strings.
 * @throws TRPCError with code `UNAUTHORIZED` if `user` is null or undefined.
 * @throws TRPCError with code `INTERNAL_SERVER_ERROR` if `user.roles` is missing or not an array of strings.
 * @throws TRPCError with code `FORBIDDEN` if `user.roles` does not include `super-admin` or `support`.
 */
export function ensureStaff(
  user: { roles?: string[] | readonly string[] | null } | null
) {
  const roles = user?.roles;
  const isRoleArray =
    Array.isArray(roles) && roles.every((role) => typeof role === 'string');

  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication failed.'
    });
  }
  if (!isRoleArray) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'User roles are not available.'
    });
  }
  if (!(roles.includes('super-admin') || roles.includes('support'))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
  }
}

/**
 * Ensures the caller is an authenticated staff user with the `super-admin` role.
 *
 * @param user - The caller's user object, or `null`/`undefined` if unauthenticated.
 * @throws TRPCError with code `UNAUTHORIZED` if `user` is `null` or `undefined`.
 * @throws TRPCError with code `INTERNAL_SERVER_ERROR` if `user.roles` is missing or not an array of strings.
 * @throws TRPCError with code `FORBIDDEN` if `user.roles` does not include `super-admin`.
 */
export function ensureSuperAdmin(
  user: { roles?: string[] | readonly string[] | null } | null
) {
  ensureStaff(user);

  const roles = user?.roles;
  const isRoleArray =
    Array.isArray(roles) && roles.every((role) => typeof role === 'string');

  if (!isRoleArray) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'User roles are not available.'
    });
  }

  if (!roles.includes('super-admin')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
  }
}