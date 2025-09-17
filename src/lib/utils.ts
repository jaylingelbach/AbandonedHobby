// ─────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────
import React from 'react';
import type { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TRPCClientError } from '@trpc/client';

import type { ProductCardProps } from '@/modules/library/ui/components/product-card';

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
function readStringProp(obj: unknown, key: string): string | undefined {
  if (!isObjectRecord(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : undefined;
}

/** Read a nested object prop (record) from an unknown object safely. */
function readRecordProp(
  obj: unknown,
  key: string
): Record<string, unknown> | undefined {
  if (!isObjectRecord(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return isObjectRecord(val) ? (val as Record<string, unknown>) : undefined;
}

/** Read an array prop from an unknown object safely. */
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
