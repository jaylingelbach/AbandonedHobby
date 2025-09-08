export type DbTenant = {
  id: string;
  slug: string;
  stripeDetailsSubmitted?: boolean;
  productCount?: number;
};

export type DbUser = {
  id: string;
  emailVerified?: boolean;
  _verified?: boolean;
  // Could be [{ tenant: DbTenant }] or [DbTenant]
  tenants?: unknown[];
  // Optional future-proofing:
  defaultTenantId?: string | null;
};

export const ONBOARDING_STEPS = [
  'verify-email',
  'create-tenant',
  'connect-stripe',
  'list-first-product',
  'dashboard'
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  step: OnboardingStep;
  label: string;
  next?: string;
};

export type PayloadUserMinimal = {
  id: string | number;
  _verified?: boolean | null;
  tenants?: unknown[] | null;
};
