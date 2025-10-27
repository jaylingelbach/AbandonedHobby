// ─────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────
import { TRPCClientError } from '@trpc/client';
import { clsx, type ClassValue } from 'clsx';
import React from 'react';
import { twMerge } from 'tailwind-merge';

import type { ProductCardProps } from '@/modules/library/ui/components/product-card';

import type { ReactNode } from 'react';
import { LexicalNode } from '@/modules/library/types';
import { carrierLabels, carriers, type Carrier } from '@/constants';

// ─────────────────────────────────────────────────────────────
// Tailwind / class utilities
// ─────────────────────────────────────────────────────────────

/** Merge conditional class names with Tailwind awareness. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────
// URL + domain helpers
// ─────────────────────────────────────────────────────────────

/**
 * Build a public tenant URL respecting dev vs prod and subdomain routing.
 * - Dev or subdomains disabled → /tenants/:slug on app URL
 * - Subdomains enabled → https://:slug.:rootDomain
 */
export function generateTenantURL(tenantSlug: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const slug = tenantSlug.trim().toLowerCase();
  const subdomainsEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === 'true';

  if (isDev || !subdomainsEnabled) {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    return `${appUrl}/tenants/${slug}`;
  }

  const domain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!domain) {
    throw new Error(
      'NEXT_PUBLIC_ROOT_DOMAIN must be set when subdomain routing is enabled in non-development.'
    );
  }

  return `https://${slug}.${domain}`;
}

/**
 * Safely parse a next/return URL and allow only same-site or whitelisted preview domains.
 * Returns null if disallowed or invalid.
 */
export const getSafeNextURL = (raw: string | null): URL | null => {
  if (!raw) return null;
  if (typeof window === 'undefined') return null; // SSR guard

  try {
    // Supports relative and absolute inputs
    const url = new URL(raw, window.location.origin);
    const host = url.hostname;

    const rootDomain = (
      process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'abandonedhobby.com'
    ).replace(/^https?:\/\//, '');

    const allowed =
      host === window.location.hostname || // same host (incl. localhost and previews)
      host === 'localhost' ||
      host === rootDomain ||
      host.endsWith(`.${rootDomain}`) ||
      (window.location.hostname.endsWith('vercel.app') &&
        host.endsWith('.vercel.app'));

    return allowed ? url : null;
  } catch {
    return null;
  }
};

/**
 * Determine the origin to use for auth routes:
 * - On Vercel previews, keep users on the same preview host
 * - Else prefer NEXT_PUBLIC_APP_URL, falling back to current origin (client) or production domain (server)
 */
export const getAuthOrigin = (): string => {
  if (
    typeof window !== 'undefined' &&
    location.hostname.endsWith('vercel.app')
  ) {
    return location.origin;
  }
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined'
      ? location.origin
      : 'https://abandonedhobby.com');

  return origin.replace(/\/$/, '');
};

/** Build the /sign-in URL, preserving a safe `next` parameter if provided. */
export const buildSignInUrl = (next?: string): string => {
  const origin = getAuthOrigin();
  const qs = next ? `?next=${encodeURIComponent(next)}` : '';
  return `${origin}/sign-in${qs}`;
};

// ─────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────

/** Format a number as currency (default USD). */
export function formatCurrency(
  value: number | string,
  currency = 'USD',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

/**
 * STRIPE SPECIFIC
 * Convert a USD amount (string or number) to integer cents using string math.
 * - Handles "12", "12.3", "12.34", "12.345" (rounds half up), "-1.23"
 * - Strips commas and $ if present.
 * - Throws on invalid input.
 */
export function usdToCents(input: string | number): number {
  const raw = typeof input === 'number' ? String(input) : input;
  const cleaned = raw.replace(/[\s,$,_]/g, '');

  // Require at least one digit before optional decimals (prevents ".99")
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid USD amount: "${input}"`);
  }

  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;

  // 👇 Provide defaults so TS knows they're strings, not string | undefined
  const [dollarsRaw, fracRaw] = unsigned.split('.');
  const dollars: string = dollarsRaw ?? '0';
  const frac: string = fracRaw ?? '';

  // Round half-up to 2 decimals without float math
  const frac3 = (frac + '000').slice(0, 3); // pad to 3 digits
  const frac2 = frac3.slice(0, 2);
  const roundDigit = frac3[2] ?? '0';

  let cents = parseInt(dollars, 10) * 100 + parseInt(frac2 || '0', 10);
  if (parseInt(roundDigit, 10) >= 5) cents += 1;

  return negative ? -cents : cents;
}

export const formatCents = (cents: number, currency = 'USD') =>
  formatCurrency(cents / 100, currency);

/** Render a React node into plain text for SEO, tooltips, etc. */
export function renderToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderToText).join(' ');
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: ReactNode }>;
    return renderToText(element.props.children);
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
// Routing helpers for product cards / app flows
// ─────────────────────────────────────────────────────────────

/**
 * Build an href for a product card given multiple variants:
 * - explicit href
 * - orderId → /orders/:orderId
 * - id → /products/:id
 */
export function buildHref(props: ProductCardProps): string {
  if ('href' in props && props.href) return props.href;
  if ('orderId' in props && props.orderId) return `/orders/${props.orderId}`;
  if ('id' in props && props.id) return `/products/${props.id}`;
  return '#'; // safe fallback
}

/** Return the first non-nullish value from the provided list, or null. */
export function pickFirstDefined<T>(
  ...values: Array<T | null | undefined>
): T | null {
  for (const value of values) if (value != null) return value as T;
  return null;
}

/**
 * Resolve a safe returnTo/next value from headers, preferring:
 *   1) x-return-to header
 *   2) ?next or ?returnTo on the Referer
 * Returns null if missing or not passing the `isSafe` guard.
 */
export function resolveReturnToFromHeaders(
  headers: Headers,
  isSafe: (value: unknown) => value is string
): string | null {
  const headerReturnTo = headers.get('x-return-to');

  let refererReturnTo: string | null = null;
  const referer = headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      refererReturnTo =
        refererUrl.searchParams.get('next') ??
        refererUrl.searchParams.get('returnTo');
    } catch {
      // ignore malformed referer
    }
  }

  const candidate = pickFirstDefined<string>(headerReturnTo, refererReturnTo);
  return isSafe(candidate) ? candidate : null;
}

// ─────────────────────────────────────────────────────────────
// tRPC helpers
// ─────────────────────────────────────────────────────────────

/** Extract the tRPC error code (e.g., 'UNAUTHORIZED') from a client error, if present. */
export function getTrpcCode(error: unknown): string | undefined {
  return error instanceof TRPCClientError ? error.data?.code : undefined;
}

// Only tiny utils and relationship coercion.
/**
 * Type guard that checks whether a value is a plain object (non-null, non-array).
 *
 * Treats any non-null object that is not an array as a Record<string, unknown>.
 *
 * @param v - Value to test
 * @returns True if `v` is an object record; otherwise false
 */

export function isObjectRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function hasStringId(v: unknown): v is { id: string } {
  return isObjectRecord(v) && typeof v.id === 'string';
}

// Relationship<T> is string | {id} | undefined
export type Relationship<T extends { id: string }> = string | T | undefined;

export function getRelId<T extends { id: string }>(
  rel: Relationship<T>
): string | undefined {
  if (typeof rel === 'string') return rel;
  if (hasStringId(rel)) return rel.id;
  return undefined;
}

/**
 * Normalize an unknown value into a Relationship<T> (string id, T, or undefined).
 *
 * If `value` is a string it is returned as the id. If `value` is an object with a string
 * `id` property, the object is returned as `T`. Otherwise `undefined` is returned.
 *
 * @param value - The value to coerce into a relationship (string id or object with `id`)
 */

export function toRelationship<T extends { id: string }>(
  value: unknown
): Relationship<T> {
  if (typeof value === 'string') return value;
  if (hasStringId(value)) return value as T;
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Safe readers
// ─────────────────────────────────────────────────────────────

/** Read a string prop from an unknown object safely. */
/**
 * Safely reads a string property from an unknown value.
 *
 * If `obj` is a plain object (non-null and not an array) and the property at `key` is a string, returns that string.
 * Otherwise returns `undefined`.
 *
 * @param obj - The value to read from (can be any type).
 * @param key - The property name to read.
 * @returns The string value at `key`, or `undefined` if the property is missing or not a string.
 */

function readStringProp(obj: unknown, key: string): string | undefined {
  if (!isObjectRecord(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : undefined;
}

/** Read a nested object prop (record) from an unknown object safely. */
/**
 * Safely reads a nested object property and returns it if it's an object (record).
 *
 * If `obj` is not an object or the property at `key` is missing or not an object, returns `undefined`.
 *
 * @param obj - The unknown value to read from.
 * @param key - The property name to read.
 * @returns The nested record at `key`, or `undefined` if not present or not an object.
 */

function readRecordProp(
  obj: unknown,
  key: string
): Record<string, unknown> | undefined {
  if (!isObjectRecord(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return isObjectRecord(val) ? (val as Record<string, unknown>) : undefined;
}

/** Read an array prop from an unknown object safely. */
/**
 * Safely reads a property as an array from an unknown value.
 *
 * Returns the property value as an array if `obj` is a plain object and the
 * named property exists and is an array; otherwise returns `undefined`.
 *
 * @param obj - Value that may be an object containing the property
 * @param key - Property name to read
 * @returns The property's array value, or `undefined` if missing or not an array
 */

function readArrayProp(obj: unknown, key: string): unknown[] | undefined {
  if (!isObjectRecord(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return Array.isArray(val) ? (val as unknown[]) : undefined;
}

// ─────────────────────────────────────────────────────────────
// Media helpers
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the best display URL from a Media-like object, preferring a given size.
 * Accepts unknown and performs full runtime guards.
 * Return the best image URL from a media-like value, preferring a specified size.
 *
 * Performs runtime-safe checks on an unknown input and supports media shapes that
 * either provide a top-level `url` (original) or a `sizes` object with `medium`
 * and/or `thumbnail` entries (each may contain a `url`).
 *
 * Preference order:
 * - If `preferred` is "medium" or "thumbnail", attempt that size's `url`, then fall
 *   back to the top-level `url` if present.
 * - If `preferred` is "original", return the top-level `url` if present.
 *
 * @param media - An unknown value that may be a media object. The function returns
 *                undefined for non-object inputs or when no URL can be found.
 * @param preferred - Which size to prefer when choosing a URL; defaults to "medium".
 * @returns The selected URL string, or `undefined` if none is available.
 */

export function getBestUrlFromMedia(
  media: unknown,
  preferred: 'medium' | 'thumbnail' | 'original' = 'medium'
): string | undefined {
  if (!isObjectRecord(media)) return undefined;

  // sizes? -> { medium?: { url? }, thumbnail?: { url? } }
  const sizes = readRecordProp(media, 'sizes');
  const originalUrl = readStringProp(media, 'url');

  if (preferred === 'medium') {
    const medium = readRecordProp(sizes, 'medium');
    const url = readStringProp(medium, 'url');
    return url ?? originalUrl ?? undefined;
  }

  if (preferred === 'thumbnail') {
    const thumb = readRecordProp(sizes, 'thumbnail');
    const url = readStringProp(thumb, 'url');
    return url ?? originalUrl ?? undefined;
  }

  // 'original'
  return originalUrl ?? undefined;
}

/**
 * Pick a single representative image URL for product cards:
 * 1) product.cover (preferred size), else
 * 2) first populated product.images[].image
 * Returns a single representative image URL for a product card.
 *
 * Tries, in order:
 * 1. `product.cover` (preferred size), then
 * 2. the first populated `product.images[][].image`.
 *
 * Accepts a product value of unknown shape; if the value is not an object or no suitable image is found, returns `undefined`.
 *
 * @param product - The product value (may be an ID string or a populated object). When passed a populated object the function reads `cover` and `images` properties.
 * @param preferred - Which size to prefer when resolving media URLs: `'medium'`, `'thumbnail'`, or `'original'`. Defaults to `'medium'`.
 * @returns The best image URL for displaying a product card, or `undefined` if none is available.
 */

export function getPrimaryCardImageUrl(
  product: unknown,
  preferred: 'medium' | 'thumbnail' | 'original' = 'medium'
): string | undefined {
  if (!isObjectRecord(product)) return undefined;

  // 1) cover
  const cover = readRecordProp(product, 'cover');
  const coverUrl = getBestUrlFromMedia(cover, preferred);
  if (coverUrl) return coverUrl;

  // 2) first gallery image
  const images = readArrayProp(product, 'images');
  if (images) {
    for (const row of images) {
      const rowObj = isObjectRecord(row)
        ? (row as Record<string, unknown>)
        : undefined;
      if (!rowObj) continue;
      const imageObj = readRecordProp(rowObj, 'image'); // skip string IDs automatically
      const url = getBestUrlFromMedia(imageObj, preferred);
      if (url) return url;
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Tenant helpers
// ─────────────────────────────────────────────────────────────

/**
 * Safely read tenant.slug when tenant may be a string ID or a populated object.
 * Safely returns a tenant's slug when `tenant` is a populated object.
 *
 * If `tenant` is a string (an ID), null, or does not have a string `slug` property, this returns `undefined`.
 *
 * @param tenant - A tenant value that may be a string ID or an object containing tenant fields
 * @returns The `slug` string if present and valid; otherwise `undefined`
 */

export function getTenantSlugSafe(tenant: unknown): string | undefined {
  if (typeof tenant === 'string' || tenant == null) return undefined;
  const obj = isObjectRecord(tenant)
    ? (tenant as Record<string, unknown>)
    : undefined;
  return obj ? readStringProp(obj, 'slug') : undefined;
}

/**
 * Safely read tenant.name when tenant may be a string ID or a populated object.
 */
export function getTenantNameSafe(tenant: unknown): string | undefined {
  if (typeof tenant === 'string' || tenant == null) return undefined;
  const obj = isObjectRecord(tenant)
    ? (tenant as Record<string, unknown>)
    : undefined;
  return obj ? readStringProp(obj, 'name') : undefined;
}

/**
 * Safely read a tenant's image URL (thumbnail by default) when tenant may be a string ID or a populated object.
 * Return a best-available image URL for a tenant, or undefined if none is available.
 *
 * Safely handles a tenant value that may be a string ID, null/undefined, or a populated object.
 * If `tenant` is an object and contains an `image` record, this returns the URL selected by the
 * `preferred` size (prefers `thumbnail` by default). Returns `undefined` for string IDs,
 * missing/invalid tenant objects, or when no suitable image URL can be resolved.
 *
 * @param preferred - Which image size to prefer when resolving a URL: `"thumbnail"`, `"medium"`, or `"original"`.
 * @returns The resolved image URL, or `undefined` if no image is available.
 */

export function getTenantImageURLSafe(
  tenant: unknown,
  preferred: 'thumbnail' | 'medium' | 'original' = 'thumbnail'
): string | undefined {
  if (typeof tenant === 'string' || tenant == null) return undefined;
  const obj = isObjectRecord(tenant)
    ? (tenant as Record<string, unknown>)
    : undefined;
  if (!obj) return undefined;
  const imageObj = readRecordProp(obj, 'image'); // only returns object, not string IDs
  return getBestUrlFromMedia(imageObj, preferred);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function nodeHasMeaningfulContent(node: unknown): boolean {
  if (node === null || typeof node !== 'object') return false;
  const n = node as LexicalNode;

  // Text with non-whitespace
  if (isNonEmptyString(n.text)) return true;

  // Media or structural nodes count as content even without text
  const contentTypes = new Set([
    'image',
    'upload',
    'link',
    'list',
    'listitem',
    'quote',
    'blockquote',
    'code',
    'heading',
    'hr',
    'autolink'
  ]);
  if (n.type && contentTypes.has(n.type)) return true;
  if (isNonEmptyString(n.src)) return true;

  // Recurse into children
  const children = toArray((n as { children?: unknown }).children);
  for (const child of children) {
    if (nodeHasMeaningfulContent(child)) return true;
  }
  return false;
}

export function isLexicalRichTextEmpty(rich: unknown): boolean {
  // Payload Lexical stores { root: { children: [...] } }
  const root = (rich as { root?: unknown })?.root as
    | { children?: unknown }
    | undefined;
  const children = toArray(root?.children);
  for (const child of children) {
    if (nodeHasMeaningfulContent(child)) return false;
  }
  return true;
}

/**
 * Builds a carrier-specific public tracking URL for a normalized tracking number.
 *
 * @param selectedCarrier - The carrier identifier.
 * @param normalizedTracking - The tracking number already normalized (trimmed, uppercased, without spaces or dashes).
 * @returns The carrier-specific tracking URL, or `undefined` if the tracking number is empty or no tracking URL is available for the carrier.
 */
export function buildTrackingUrl(
  selectedCarrier: Carrier,
  normalizedTracking: string
): string | undefined {
  if (!normalizedTracking) return undefined;
  if (selectedCarrier === 'usps') {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(
      normalizedTracking
    )}`;
  }
  if (selectedCarrier === 'ups') {
    return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(
      normalizedTracking
    )}`;
  }
  if (selectedCarrier === 'fedex') {
    return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(
      normalizedTracking
    )}`;
  }
  return undefined;
}
