import { NextRequest, NextResponse } from 'next/server';
import { moderationRequestSchema } from './schema';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { Product } from '@/payload-types';
import { isNotFound } from '@/lib/server/utils';

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
  const parsedBody = moderationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        issues: parsedBody.error.flatten()
      },
      { status: 400 }
    );
  }

  const { reason, otherText } = parsedBody.data;

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

  // Update product with signal
  let product: Product;
  try {
    product = await payload.findByID({
      collection: 'products',
      id: productId,
      overrideAccess: true
    });
    if (product.isArchived || product.isRemovedForPolicy) {
      return NextResponse.json(
        { error: `Listing can not be reported in its current state.` },
        { status: 409 }
      );
    }

    await payload.update({
      collection: 'products',
      id: productId,
      overrideAccess: true,
      data: {
        isFlagged: true,
        flagReason: reason,
        flagReasonOtherText: otherText ?? undefined
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[Moderation] there was a problem flagging productId: ${productId} for ${reason} for route /api/(moderation)/[productId]`
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Success' }, { status: 200 });
}
