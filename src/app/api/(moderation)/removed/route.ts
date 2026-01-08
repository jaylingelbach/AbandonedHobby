// ─── Next.js / Framework Built-ins ───────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

// ─── Payload CMS ─────────────────────────────────────────────────────────────
import { getPayload } from 'payload';
import config from '@/payload.config';

// ─── Project Constants / Types ───────────────────────────────────────────────
import { flagReasonLabels } from '@/constants';

// ─── Project Features / Modules ──────────────────────────────────────────────
import { ModerationInboxItem } from '@/app/(app)/staff/moderation/types';
import {
  isPopulatedTenant,
  resolveThumbnailUrl
} from '@/app/api/(moderation)/inbox/utils';

/**
 * Handle GET requests to return a list of removed products.
 *
 * Enforces authentication and requires the requesting user to have the `super-admin` role; responds with 401 if unauthenticated or 403 if not authorized. On success returns up to 50 products that are flagged, not removed for policy, and not archived, mapped to moderation inbox item objects.
 *
 * @returns A JSON HTTP response containing an array of removed items on success, or an error object with an `error` message and the appropriate HTTP status code (401, 403, or 500).
 */
export async function GET(request: NextRequest) {
  let removedItems: ModerationInboxItem[] = [];

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
        reportedAtLabel: new Date(product.updatedAt).toLocaleDateString()
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
