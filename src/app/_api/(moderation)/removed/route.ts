// ─── Next.js / Framework Built-ins ───────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

// ─── Payload CMS ─────────────────────────────────────────────────────────────
import { getPayload } from 'payload';
import config from '@/payload.config';

// ─── Project Constants / Types ───────────────────────────────────────────────
import { flagReasonLabels } from '@/constants';

// ─── Project Features / Modules ──────────────────────────────────────────────
import { ModerationRemovedItemDTO } from '@/app/(app)/staff/moderation/types';
import {
  isPopulatedTenant,
  resolveThumbnailUrl
} from '@/app/_api/(moderation)/inbox/utils';

/**
 * Retrieve a list of products that were removed for policy for moderation by super-admins.
 *
 * Authenticates the request via Payload CMS and, for users with the `super-admin` role,
 * returns up to 50 products that are flagged, removed for policy, and archived, sorted by most recently updated.
 *
 * @param request - The incoming Next.js request used for authentication and header forwarding
 * @returns An array of ModerationInboxItem representing removed products (id, productName, tenantName, tenantSlug, flagReasonLabel, optional flagReasonOtherText, thumbnailUrl, flaggedAt)
 * @throws Responds with HTTP 401 if authentication fails, 403 if the authenticated user is not a `super-admin`, or 500 on server error (error message is generic in production)
 */
export async function GET(request: NextRequest) {
  let removedItems: ModerationRemovedItemDTO[] = [];

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
          { isFlagged: { not_equals: false } },
          { isRemovedForPolicy: { not_equals: false } },
          { isArchived: { not_equals: false } }
        ]
      },
      limit: 50,
      sort: '-updatedAt'
    });
    removedItems = result.docs.map((product) => {
      const tenant = product.tenant;

      const tenantName = isPopulatedTenant(tenant) ? (tenant.name ?? '') : '';
      const tenantSlug = isPopulatedTenant(tenant) ? (tenant.slug ?? '') : '';

      const thumbnailUrl = resolveThumbnailUrl(product);

      return {
        id: product.id,
        productName: product.name,
        tenantName,
        tenantSlug,
        flagReasonLabel: product.flagReason
          ? flagReasonLabels[product.flagReason]
          : 'Unknown',
        flagReasonOtherText: product.flagReasonOtherText ?? undefined,
        thumbnailUrl,
        flaggedAt: product.flaggedAt ?? null,
        moderationNote: product.moderationNote ?? undefined
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[Moderation] there was a problem getting removed items:`,
        message
      );
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
  return NextResponse.json(removedItems, { status: 200 });
}
