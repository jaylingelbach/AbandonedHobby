import { NextRequest, NextResponse } from 'next/server';
import { getPresignedPutUrl, publicUrlForKey } from '@/lib/server/s3';

export const runtime = 'nodejs';

// Simple guard so it won't run in production by accident
/**
 * Prevents this code path from running in production.
 *
 * Throws an error if NODE_ENV === 'production' to ensure the endpoint is used only for local/dev testing.
 *
 * @throws Error when NODE_ENV is 'production'.
 */

function assertDev(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('This endpoint is for local/dev testing only.');
  }
}

/**
 * Generates a presigned S3 PUT URL for uploading a product asset (development only).
 *
 * Reads query parameters:
 * - `tenantSlug` (default: "test-tenant")
 * - `productId` (default: "test-product")
 * - `contentType` (default: "image/jpeg")
 *
 * Chooses a file extension from `contentType` (`png`, `webp`, `avif`, or `jpg`), constructs a unique S3 key
 * `products/{tenantSlug}/{productId}/{uuid}.{ext}`, requests a presigned PUT URL valid for 300 seconds, and returns
 * a JSON response containing `{ url, key, publicUrl, contentType }`.
 *
 * On failure returns a JSON `{ error }` with HTTP status 500.
 *
 * @returns A NextResponse with either the presigned upload info (`{ url, key, publicUrl, contentType }`) or an error payload.
 */

export async function GET(req: NextRequest) {
  try {
    assertDev();

    const { searchParams } = new URL(req.url);
    const tenantSlug = searchParams.get('tenantSlug') ?? 'test-tenant';
    const productId = searchParams.get('productId') ?? 'test-product';
    const contentType = searchParams.get('contentType') ?? 'image/jpeg';

    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/avif'
            ? 'avif'
            : 'jpg';

    const id = crypto.randomUUID();
    const key = `products/${tenantSlug}/${productId}/${id}.${ext}`;

    const url = await getPresignedPutUrl({
      key,
      contentType,
      expiresSeconds: 300
    });

    const publicUrl = publicUrlForKey(key);
    return NextResponse.json({ url, key, publicUrl, contentType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
