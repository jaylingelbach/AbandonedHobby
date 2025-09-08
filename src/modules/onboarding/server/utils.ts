import { DbTenant, DbUser, OnboardingState } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDbTenant(value: unknown): value is DbTenant {
  return (
    isRecord(value) && typeof (value as { slug?: unknown }).slug === 'string'
  );
}

function hasTenantProp(value: unknown): value is { tenant: unknown } {
  return isRecord(value) && 'tenant' in value;
}

function asTenant(entry: unknown): DbTenant | null {
  if (isDbTenant(entry)) return entry;
  if (hasTenantProp(entry) && isDbTenant(entry.tenant)) return entry.tenant;
  return null;
}

/** Pick the active tenant for a user, preferring `defaultTenantId` when set. */
export function getActiveTenant(user: DbUser): DbTenant | null {
  const memberships = user.tenants ?? [];

  if (user.defaultTenantId) {
    const preferred =
      memberships
        .map(asTenant)
        .find((tenant) => tenant?.id === user.defaultTenantId) ?? null;
    if (preferred) return preferred;
  }

  return asTenant(memberships[0]);
}

function isVerified(user: DbUser): boolean {
  return user._verified === true || user.emailVerified === true;
}

/* ──────────────────────── main API ───────────────────────── */

export function computeOnboarding(user: DbUser): OnboardingState {
  if (!isVerified(user)) {
    return {
      step: 'verify-email',
      label: 'Verify your email to continue',
      next: '/verify'
    };
  }

  const activeTenant = getActiveTenant(user);
  if (!activeTenant) {
    return {
      step: 'create-tenant',
      label: 'Create your store',
      next: '/sell/start'
    };
  }

  if (!activeTenant.stripeDetailsSubmitted) {
    return {
      step: 'connect-stripe',
      label: 'Connect Stripe to start selling',
      next: '/stripe-verify'
    };
  }

  const hasProducts = (activeTenant.productCount ?? 0) > 0;
  if (!hasProducts) {
    return {
      step: 'list-first-product',
      label: 'List your first item',
      next: `/t/${activeTenant.slug}/products/new`
    };
  }

  return {
    step: 'dashboard',
    label: 'All set!',
    next: `/t/${activeTenant.slug}/dashboard`
  };
}

export function toDbUser(rawUser: {
  id: string | number;
  _verified?: boolean | null;
  _verifiedAt?: string | Date | null;
  tenants?: unknown[] | null;
}) {
  return {
    id: String(rawUser.id),
    _verified: rawUser._verified === true || !!rawUser._verifiedAt,
    tenants: Array.isArray(rawUser.tenants) ? rawUser.tenants : []
  };
}

/** Allow only same-origin, path-only redirects (e.g. "/welcome"). */
export function isSafeReturnTo(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (!trimmed.startsWith('/')) return false; // must be path-only
  if (trimmed.startsWith('//')) return false; // disallow protocol-relative
  if (trimmed.includes('\\')) return false; // no backslashes
  if (/[\r\n]/.test(trimmed)) return false; // no control chars

  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded.startsWith('//')) return false;
  } catch {
    /* ignore bad encodings */
  }

  return trimmed.length <= 2048;
}
