import type { Tenant } from '@/payload-types';

type TenantRel = {
  tenant: string | Pick<Tenant, 'id'> | { id?: string | null };
};

function isTenantRel(value: unknown): value is TenantRel {
  if (typeof value !== 'object' || value === null) return false;
  const tenant = (value as { tenant?: unknown }).tenant;
  if (typeof tenant === 'string') return true;
  if (typeof tenant === 'object' && tenant !== null) {
    const id = (tenant as { id?: unknown }).id;
    return id === undefined || id === null || typeof id === 'string';
  }
  return false;
}

export function getFirstTenantId(
  user: { tenants?: unknown[] } | null | undefined
): string | null {
  const raw = user?.tenants;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const rel = raw.find(isTenantRel);
  if (!rel) return null;

  const tenant = rel.tenant;
  return typeof tenant === 'string' ? tenant : (tenant.id ?? null);
}
