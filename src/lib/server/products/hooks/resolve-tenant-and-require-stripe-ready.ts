import { User } from '@/payload-types';
import { CollectionBeforeChangeHook, type Payload } from 'payload';
import { isTenantWithStripeFields } from '../../utils';

// Resolve the effective tenant (incoming → original → user’s first) and require Stripe readiness.
export const resolveTenantAndRequireStripeReady: CollectionBeforeChangeHook =
  async ({
    req,
    operation,
    data,
    originalDoc
  }: {
    req: {
      user?: User | null;
      context?: Record<string, unknown>;
      payload: Payload;
    }; // payload type is provided by Payload; leave as-is from your file
    operation: 'create' | 'update' | 'delete';
    data: Record<string, unknown>;
    originalDoc?: Record<string, unknown>;
  }) => {
    if (operation !== 'create' && operation !== 'update') return data;

    // Allow system/webhook writes and other server-initiated writes
    if (req.context?.ahSystem) return data;

    const user = req.user as User | undefined;
    if (!user) return data; // unauthenticated server-side writes

    if (user.roles?.includes('super-admin')) return data;

    // Helper: normalize relationship to string id
    const relToId = (rel: unknown): string | null => {
      if (typeof rel === 'string') return rel;
      if (rel && typeof rel === 'object' && 'id' in (rel as { id?: unknown })) {
        const id = (rel as { id?: unknown }).id;
        return typeof id === 'string' ? id : null;
      }
      return null;
    };

    // 1) Try incoming product tenant first
    let tenantId: string | null = relToId(
      (data as { tenant?: unknown }).tenant
    );

    // 2) If missing on create/update, prefer original doc’s tenant (on update)
    if (!tenantId && originalDoc) {
      tenantId = relToId((originalDoc as { tenant?: unknown }).tenant);
    }

    // 3) Finally, fall back to the user’s first tenant
    if (!tenantId) {
      const first = user.tenants?.[0]?.tenant;
      tenantId = relToId(first);
    }

    if (!tenantId) {
      throw new Error('A tenant must be specified for this product.');
    }

    // Ensure the user is a member of the resolved tenant
    const isMember =
      Array.isArray(user.tenants) &&
      user.tenants.some((t) => relToId(t?.tenant) === tenantId);

    if (!isMember) {
      throw new Error('You are not a member of the selected tenant.');
    }

    // Stripe readiness check for the resolved tenant
    const tenantRaw = await req.payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0
    });

    if (!isTenantWithStripeFields(tenantRaw)) {
      throw new Error('Invalid tenant record.');
    }

    const stripeReady =
      typeof tenantRaw.stripeAccountId === 'string' &&
      tenantRaw.stripeAccountId.length > 0 &&
      tenantRaw.stripeDetailsSubmitted === true;

    if (!stripeReady) {
      throw new Error(
        'This tenant must complete Stripe verification before creating or editing products.'
      );
    }

    return data;
  };
