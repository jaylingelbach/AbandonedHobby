import { ClientUser } from 'payload';

import type { Access } from 'payload';
import type { User } from '@/payload-types';

export const mustBeStripeVerified: Access = async ({ req }) => {
  const user = req.user as User;
  if (!user) return false;
  if (user.roles?.includes('super-admin')) return true;

  const rel = user?.tenants?.[0]?.tenant;
  const tenantId = typeof rel === 'string' ? rel : rel?.id;
  if (!tenantId) return false;

  const tenant = await req.payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0
  });

  return Boolean(
    tenant?.stripeAccountId && tenant?.stripeDetailsSubmitted
    // && tenant?.stripeChargesEnabled // ✅ optional harder gate
  );
};

export const isSuperAdmin = (user: User | ClientUser | null) => {
  return Boolean(user?.roles?.includes('super-admin'));
};
