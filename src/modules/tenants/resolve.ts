import type { Payload } from 'payload';
import type { Tenant, User } from '@/payload-types';

export type TenantWithContact = Tenant & {
  notificationEmail?: string | null;
  notificationName?: string | null;
  primaryContact?: string | User | null;
};

export async function resolveTenantForEvent(
  payload: Payload,
  meta: { tenantId?: string | null },
  connectedAccountId?: string | null
): Promise<TenantWithContact> {
  let tenantDoc: TenantWithContact | null = null;

  if (meta.tenantId) {
    try {
      tenantDoc = (await payload.findByID({
        collection: 'tenants',
        id: meta.tenantId,
        depth: 1,
        overrideAccess: true
      })) as TenantWithContact;
    } catch {
      /* fallthrough */
    }
  }

  if (!tenantDoc && connectedAccountId) {
    const lookup = await payload.find({
      collection: 'tenants',
      where: { stripeAccountId: { equals: connectedAccountId } },
      limit: 1,
      depth: 1,
      overrideAccess: true
    });
    tenantDoc = (lookup.docs[0] ?? null) as TenantWithContact | null;
  }

  if (!tenantDoc) {
    throw new Error(
      `No tenant resolved. meta.tenantId=${meta.tenantId ?? 'null'} event.account=${connectedAccountId ?? 'null'}`
    );
  }
  return tenantDoc;
}
