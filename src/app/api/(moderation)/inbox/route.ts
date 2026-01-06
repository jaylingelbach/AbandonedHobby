import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { ModerationInboxItem } from '@/app/(app)/staff/moderation/types';
import { flagReasonLabels } from '@/constants';
import type { Product, Tenant } from '@/payload-types';

export async function GET(request: NextRequest) {
  function isPopulatedTenant(value: Product['tenant']): value is Tenant {
    return !!value && typeof value === 'object' && 'slug' in value;
  }

  let moderationInboxItems: ModerationInboxItem[] = [];
  // Auth
  const payload = await getPayload({ config });
  const { user } = await payload.auth({
    headers: request.headers
  });
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication failed.' },
      { status: 401 }
    );
  }
  if (!user.roles?.includes('super-admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const result = await payload.find({
      collection: 'products',
      depth: 1,
      where: {
        and: [
          { isFlagged: { equals: true } },
          { isRemovedForPolicy: { equals: false } },
          { isArchived: { equals: false } }
        ]
      },
      sort: '-updatedAt'
    });
    moderationInboxItems = result.docs.map((product) => {
      const tenant = product.tenant;

      const tenantName = isPopulatedTenant(tenant) ? (tenant.name ?? '') : '';
      const tenantSlug = isPopulatedTenant(tenant) ? (tenant.slug ?? '') : '';

      return {
        id: product.id,
        productName: product.name,
        tenantName,
        tenantSlug,
        flagReasonLabel: product.flagReason
          ? flagReasonLabels[product.flagReason]
          : 'Unknown',
        flagReasonOtherText: product.flagReasonOtherText ?? undefined,
        thumbnailUrl: null, // or wire up images later
        reportedAt: product.updatedAt,
        reportedAtLabel: new Date(product.updatedAt).toLocaleDateString()
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (process.env.NODE_ENV !== 'production') {
      console.error(`[Moderation] there was a problem getting inbox items`);
    }
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : message
      },
      { status: 500 }
    );
  }
  return NextResponse.json(moderationInboxItems, { status: 200 });
}
