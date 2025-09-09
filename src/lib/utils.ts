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
  const subdomainsEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === 'true';

  if (isDev || !subdomainsEnabled) {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    return `${appUrl}/tenants/${tenantSlug}`;
  }

  const domain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!domain) {
    throw new Error(
      'NEXT_PUBLIC_ROOT_DOMAIN must be set when subdomain routing is enabled in non-development.'
    );
  }

  return `https://${tenantSlug}.${domain}`;
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
  }).format(Number(value));
}

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
