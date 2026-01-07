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

/**
 * Handle POST requests that mark a product as removed for policy and archive it.
 *
 * Validates the request body against `moderationRemoveSchema`, requires an authenticated user
 * with the `super-admin` role, verifies the product exists and is not already archived/removed,
 * and updates the product's `isRemovedForPolicy`, `moderationNote`, and `isArchived` fields.
 *
 * @param params - An object (resolved promise) containing route parameters; must include `productId` identifying the target product.
 * @returns A NextResponse containing:
 * - `{ message: 'Success' }` with status 200 on successful update.
 * - `{ error: 'Invalid JSON body' }` with status 400 when the request body is not valid JSON.
 * - `{ error: 'Invalid request body', issues: ... }` with status 400 when schema validation fails.
 * - `{ error: 'Authentication failed.' }` with status 401 when no authenticated user is present.
 * - `{ error: 'Not authorized' }` with status 403 when the user lacks the `super-admin` role.
 * - `{ error: 'Product not found' }` with status 404 when the product does not exist.
 * - `{ error: 'Listing is already archived or removed for policy violations.' }` with status 409 when the product is already archived or removed.
 * - `{ error: 'Internal server error' }` with status 500 in production, or the underlying error message in non-production environments for unexpected failures.
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

    await payload.update({
      collection: 'products',
      id: productId,
      overrideAccess: true,
      data: {
        isRemovedForPolicy: true,
        moderationNote,
        isArchived: true
      }
    });
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
