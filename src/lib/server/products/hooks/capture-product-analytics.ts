import { captureProductListed, ph } from '@/lib/analytics/ph-utils/ph-server';
import { User } from '@/payload-types';
import { CollectionAfterChangeHook } from 'payload';

// Fire productListed analytics on create (with optional group identify).
export const captureProductAnalytics: CollectionAfterChangeHook = async ({
  req,
  doc,
  operation
}) => {
  // fire only when a product is first created
  if (operation !== 'create') return;

  // who created it?
  const user = req.user as User | undefined;
  const distinctId = user?.id ?? 'system';

  // tenant relationship can be string id or { id, slug, … }
  const tenantRel = doc.tenant as
    | string
    | { id?: string; slug?: string }
    | null
    | undefined;
  const tenantId = typeof tenantRel === 'string' ? tenantRel : tenantRel?.id;
  const tenantSlug =
    typeof tenantRel === 'object' && tenantRel !== null
      ? tenantRel.slug
      : undefined;

  try {
    // optional: attach group identity so you can analyze by tenant
    if (ph && tenantId) {
      ph.groupIdentify({
        groupType: 'tenant',
        groupKey: tenantId,
        properties: tenantSlug ? { tenantSlug } : {}
      });
    }

    await captureProductListed(
      distinctId,
      {
        productId: doc.id,
        price: typeof doc.price === 'number' ? doc.price : undefined,
        currency: 'USD',
        tenantSlug
      },
      tenantId ? { tenant: tenantId } : undefined
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[analytics] productListed failed:', err);
    }
  }
};
