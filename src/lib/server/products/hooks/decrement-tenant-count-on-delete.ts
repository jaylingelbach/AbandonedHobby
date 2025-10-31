import { CollectionAfterDeleteHook } from 'payload';
import { incTenantProductCount } from '../../utils';

export const decrementTenantCountOnDelete: CollectionAfterDeleteHook = async ({
  req,
  doc
}) => {
  const tenantId =
    typeof doc.tenant === 'string'
      ? doc.tenant
      : ((doc.tenant as { id?: string })?.id ?? null);
  if (tenantId) {
    await incTenantProductCount(req.payload, tenantId, -1);
  }
};
