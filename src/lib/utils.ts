import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateTenantURL(tenantSlug: string) {
  const isDev = process.env.NODE_ENV === 'development';
  const isSubdomainRoutingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SUBDOMAIN_ROUTING === 'true';

  const shouldUseSubdomain = isSubdomainRoutingEnabled && !isDev;
  const protocol = shouldUseSubdomain ? 'https' : 'http';

  let domain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  if (!domain) {
    throw new Error('NEXT_PUBLIC_ROOT_DOMAIN environment variable is required');
  }

  // Remove protocol if it accidentally exists in domain
  domain = domain.replace(/^https?:\/\//, '');

  if (protocol === 'http') {
    return `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${tenantSlug}`;
  }

  return `${protocol}://${tenantSlug}.${domain}`;
}

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value));
}
