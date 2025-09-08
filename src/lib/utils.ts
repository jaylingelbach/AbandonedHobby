import React from 'react';
import type { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProductCardProps } from '@/modules/library/ui/components/product-card';
import { TRPCClientError } from '@trpc/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateTenantURL(tenantSlug: string) {
  const isDev = process.env.NODE_ENV === 'development';
  const subdomains =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === 'true';

  if (isDev || !subdomains) {
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

export function formatCurrency(
  value: number | string,
  currency = 'USD',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(Number(value));
}

export function renderToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderToText).join(' ');
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: ReactNode }>;
    return renderToText(el.props.children);
  }
  return '';
}

export const getSafeNextURL = (raw: string | null): URL | null => {
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin); // supports relative + absolute
    const host = url.hostname;

    const ROOT_DOMAIN = (
      process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'abandonedhobby.com'
    ).replace(/^https?:\/\//, '');

    const allowed =
      host === window.location.hostname || // same host (incl. localhost and previews)
      host === 'localhost' ||
      host === ROOT_DOMAIN ||
      host.endsWith(`.${ROOT_DOMAIN}`) ||
      (window.location.hostname.endsWith('vercel.app') &&
        host.endsWith('.vercel.app'));

    return allowed ? url : null;
  } catch {
    return null;
  }
};

export const getAuthOrigin = () => {
  // In previews, keep users on the same preview host
  if (
    typeof window !== 'undefined' &&
    location.hostname.endsWith('vercel.app')
  ) {
    return location.origin;
  }

  // Otherwise use your configured origin, falling back to the current one
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined'
      ? location.origin
      : 'https://abandonedhobby.com');

  return origin.replace(/\/$/, '');
};

export const buildSignInUrl = (next?: string) => {
  const origin = getAuthOrigin();
  const qs = next ? `?next=${encodeURIComponent(next)}` : '';
  return `${origin}/sign-in${qs}`;
};

// used in product card and built for 2 variants. one with id and one with orderId
export function buildHref(props: ProductCardProps): string {
  if ('href' in props && props.href) return props.href;
  if ('orderId' in props && props.orderId) return `/orders/${props.orderId}`;
  if ('id' in props && props.id) return `/products/${props.id}`;
  return '#'; // safe fallback
}

export function pickFirstDefined<T>(
  ...vals: Array<T | null | undefined>
): T | null {
  for (const v of vals) if (v != null) return v as T;
  return null;
}

export function resolveReturnToFromHeaders(
  headers: Headers,
  isSafe: (v: unknown) => v is string
): string | null {
  const headerRT = headers.get('x-return-to');

  let refererRT: string | null = null;
  const referer = headers.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      refererRT = u.searchParams.get('next') ?? u.searchParams.get('returnTo');
    } catch {
      /* ignore */
    }
  }

  const candidate = pickFirstDefined<string>(headerRT, refererRT);
  return isSafe(candidate) ? candidate : null;
}

export function getTrpcCode(error: unknown): string | undefined {
  return error instanceof TRPCClientError ? error.data?.code : undefined;
}
