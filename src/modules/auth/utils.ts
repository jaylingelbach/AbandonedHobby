import { cookies as getCookies } from 'next/headers';

interface Props {
  prefix: string;
  value: string;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateTenantURL(tenantSlug: string) {
  const isDev = process.env.NODE_ENV === 'development';
  const isSubdomainRoutingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === 'true';

  // In dev OR when subdomains are disabled → use path routing
  if (isDev || !isSubdomainRoutingEnabled) {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    return `${appUrl}/tenants/${tenantSlug}`;
  }

  // Subdomains in non-dev → need a root domain
  const domain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!domain) {
    throw new Error(
      'NEXT_PUBLIC_ROOT_DOMAIN must be set when subdomain routing is enabled in non-development.'
    );
  }

  const protocol = 'https';
  return `${protocol}://${tenantSlug}.${domain}`;
}

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value));
}

export const generateAuthCookie = async ({ prefix, value }: Props) => {
  const cookies = await getCookies();
  cookies.set({
    name: `${prefix}-token`,
    value: value,
    httpOnly: true,
    path: '/',
    sameSite: process.env.NEXT_PUBLIC_ROOT_DOMAIN ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(process.env.NEXT_PUBLIC_ROOT_DOMAIN
      ? { domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN }
      : {}),
    maxAge: 60 * 60 * 24 * 7
  });
};
