// ─── Next.js / Framework Built-ins ───────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

// ─── Payload CMS ─────────────────────────────────────────────────────────────
import { getPayload } from 'payload';
import config from '@/payload.config';

// ─── Project Types ───────────────────────────────────────────────────────────
import { Product } from '@/payload-types';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { isNotFound } from '@/lib/server/utils';
import { moderationRemoveSchema } from '@/app/api/(moderation)/[productId]/schema';
import { sendRemovalEmail } from '@/lib/sendEmail';
import { isPopulatedTenant } from '../../inbox/utils';
import { isNonEmptyString } from '@/lib/utils';

/**
 * Mark a product as removed for policy and archive it.
 *
 * Validates the request body, requires an authenticated user with the `super-admin` role,
 * updates the product's `isRemovedForPolicy`, `moderationNote`, and `isArchived` fields,
 * and conditionally sends a tenant removal notification email when tenant contact details are available.
 *
 * @param params - An object resolving to route parameters; must include `productId` for the target product.
 * @returns An object with one of the following shapes:
 * - `{ message: 'Success' }` on successful update.
 * - `{ error: string }` on failure.
 * - `{ error: string, issues: unknown }` when request body validation fails.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
): Promise<NextResponse> {
  let body: unknown;
  const { productId } = await params;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsedBody = moderationRemoveSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        issues: parsedBody.error.flatten()
      },
      { status: 400 }
    );
  }

  const { moderationNote } = parsedBody.data;

  // ---------- Auth ----------
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

  // Update product
  let product: Product;
  try {
    product = await payload.findByID({
      collection: 'products',
      id: productId,
      overrideAccess: true
    });
    if (product.isArchived || product.isRemovedForPolicy) {
      return NextResponse.json(
        {
          error: `Listing is already archived or removed for policy violations.`
        },
        { status: 409 }
      );
    }

    const res = await payload.update({
      collection: 'products',
      id: productId,
      overrideAccess: true,
      data: {
        isRemovedForPolicy: true,
        moderationNote,
        isArchived: true
      }
    });

    if (res.isArchived && res.isRemovedForPolicy) {
      const tenant = res.tenant;
      const name = isPopulatedTenant(tenant)
        ? (tenant.notificationName ?? '')
        : '';
      const to = isPopulatedTenant(tenant)
        ? (tenant.notificationEmail ?? '')
        : '';
      const item = res;

      if (isNonEmptyString(name) && isNonEmptyString(to)) {
        try {
          await sendRemovalEmail({ to, name, item });
        } catch (error) {
          // Log but don't fail the whole request
          console.error('Error sending removal email:', error);
        }
      } else {
        console.error(
          'Skipping removal email: missing tenant notificationName/notificationEmail'
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[Moderation] there was a problem removing productId: ${productId} with note: ${moderationNote} for route /api/(moderation)/[productId]/remove`
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
  return NextResponse.json({ message: 'Success' }, { status: 200 });
}