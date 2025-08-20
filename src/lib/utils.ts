import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateTenantURL(tenantSlug: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const subdomainsEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === 'true';

  // Dev or subdomains disabled → path-based URL using APP_URL
  if (!isProd || !subdomainsEnabled) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    if (!appUrl) {
      throw new Error(
        'NEXT_PUBLIC_APP_URL must be set when subdomain routing is disabled or in development'
      );
    }
    return `${appUrl}/tenants/${tenantSlug}`;
  }

  // Prod with subdomains → require apex domain
  const domain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/:\d+$/, '');

  if (!domain) {
    throw new Error(
      'NEXT_PUBLIC_ROOT_DOMAIN must be set to your apex domain (e.g., abandonedhobby.com) when subdomain routing is enabled in production'
    );
  }

  return `https://${tenantSlug}.${domain}`;
}

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value));
}
