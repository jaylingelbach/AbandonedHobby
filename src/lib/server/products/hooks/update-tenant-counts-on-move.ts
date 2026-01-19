import { CollectionAfterChangeHook } from 'payload';

import { incTenantProductCount, swapTenantCountsAtomic } from '../../utils';

type HookContext = {
  skipSideEffects?: boolean;
};

// When tenant changes (A→B / A→null / null→B), atomically swap or increment/decrement counts.
export const updateTenantCountsOnMove: CollectionAfterChangeHook = async ({
  req,
  doc,
  previousDoc,
  operation
}) => {
  // Internal cleanup writes (e.g., clearing moderationIntent) should not trigger side effects.
  const context = (req.context ?? {}) as HookContext;
  if (context.skipSideEffects) return;

  const previousTenantId =
    typeof previousDoc?.tenant === 'string'
      ? previousDoc.tenant
      : ((previousDoc?.tenant as { id?: string })?.id ?? null);

  const nextTenantId =
    typeof doc.tenant === 'string'
      ? doc.tenant
      : ((doc.tenant as { id?: string })?.id ?? null);

  if (operation === 'create' || operation === 'update') {
    if (previousTenantId !== nextTenantId) {
      if (previousTenantId && nextTenantId) {
        // swap A → B: do both inside a transaction
        await swapTenantCountsAtomic(
          req.payload,
          previousTenantId,
          nextTenantId
        );
      } else if (previousTenantId) {
        // detach: A → null
        await incTenantProductCount(req.payload, previousTenantId, -1);
      } else if (nextTenantId) {
        // attach: null → B
        await incTenantProductCount(req.payload, nextTenantId, +1);
      }
    }
  }
};
