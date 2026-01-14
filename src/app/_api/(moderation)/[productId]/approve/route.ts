// ─── Core Frameworks ─────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

// ─── Payload CMS ─────────────────────────────────────────────────────────────
import { getPayload } from 'payload';
import config from '@/payload.config';

// ─── Project Types ───────────────────────────────────────────────────────────
import { Product } from '@/payload-types';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { isNotFound } from '@/lib/server/utils';

// ─── Validation Schemas ──────────────────────────────────────────────────────
import { moderationApproveSchema } from '@/app/_api/(moderation)/[productId]/schema';

/**
 * Unflags a product by ID after validating the request body and enforcing super-admin authorization.
 *
 * @param request - The incoming NextRequest whose JSON body must satisfy `moderationApproveSchema` (provides `moderationNote`).
 * @param params - An object promise that resolves to `{ productId }`, the ID of the product to unflag.
 * @returns A NextResponse containing JSON; on success `{ message: 'Success' }` with status 200, otherwise an `error` (and optional `issues`) with an appropriate HTTP status (400, 401, 403, 404, 409, or 500).
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
  const parsedBody = moderationApproveSchema.safeParse(body);
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
  console.log(`[moderation] post route moderationNote: ${moderationNote}`);

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

  // Update product with signal
  let product: Product;
  try {
    product = await payload.findByID({
      collection: 'products',
      id: productId,
      overrideAccess: true
    });
    if (
      product.isArchived ||
      product.isRemovedForPolicy ||
      product.isFlagged === false
    ) {
      return NextResponse.json(
        { error: `Listing can not be unflagged in its current state.` },
        { status: 409 }
      );
    }

    await payload.update({
      collection: 'products',
      id: productId,
      overrideAccess: true,
      data: {
        isFlagged: false,
        moderationNote,
        approvedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[Moderation] there was a problem unflagging productId: ${productId} with note: ${moderationNote} for route /api/(moderation)/[productId]/approve`
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
