'use client';

import { Button } from '@/components/ui/button';
// ─── Project Types / Features ────────────────────────────────────────────────
import { ModerationRemovedItemDTO } from './types';
import Image from 'next/image';
import Link from 'next/link';
import { BASE_LISTING_CLASS } from './constants';

interface RemovedRowProps {
  item: ModerationRemovedItemDTO;
}

/**
 * Renders a moderation "removed" list row showing product, shop, flag reason, reporter comments, and action links.
 *
 * Conditionally displays a thumbnail (or a "Photo" placeholder) and reporter comments when present, and includes
 * buttons linking to the public listing and the admin payload for the product.
 *
 * @param item - Moderation item containing `id`, `productName`, `tenantName`, `tenantSlug`, `flagReasonLabel`, `flagReasonOtherText`, `thumbnailUrl`, and `reportedAtLabel`
 * @returns A React element representing the moderation removed row
 */
export default function RemovedRow({ item }: RemovedRowProps) {
  const {
    id,
    productName,
    tenantName,
    tenantSlug,
    flagReasonLabel,
    flagReasonOtherText,
    thumbnailUrl,
    reportedAtLabel,
    removedAtLabel
  } = item;

  return (
    <article className="rounded-lg border-2 border-black bg-card p-4 lg:p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: product + shop */}
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border-2 border-black bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={`Photo for ${productName}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>Photo</span>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold leading-snug">
              {productName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Shop:{' '}
              <span className="font-medium">
                {tenantName} ({tenantSlug})
              </span>
            </p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium">Reported:</span> {reportedAtLabel}
              </p>
              <p>
                <span className="font-medium">Removed:</span> {removedAtLabel}
              </p>
            </div>
            <div className="mt-2 inline-flex items-center gap-2 text-xs">
              <span className="rounded-full border border-black bg-yellow-200 px-2 py-0.5 font-semibold uppercase tracking-wide">
                {flagReasonLabel}
              </span>
            </div>
          </div>
        </div>

        {/* “Other” text / notes */}
        <div className="flex-1 lg:px-4">
          {flagReasonOtherText ? (
            <div className="rounded-md border border-dashed border-black bg-muted px-3 py-2 text-xs leading-relaxed">
              <p className="mb-1 font-semibold uppercase tracking-wide text-[11px] text-muted-foreground">
                Reporter comments
              </p>
              <p className="wrap-break-word">{flagReasonOtherText}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No additional comments from reporter.
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 min-w-45">
          <Button asChild className={BASE_LISTING_CLASS} variant="ghost">
            <Link
              href={`/tenants/${tenantSlug}/products/${id}`}
              className="flex justify-center hover:bg-pink-500 hover:text-primary"
            >
              View listing
            </Link>
          </Button>
          <Button asChild className={BASE_LISTING_CLASS} variant="ghost">
            <Link
              href={`/admin/collections/products/${id}`}
              className="flex justify-center hover:bg-pink-500 hover:text-primary"
            >
              View in Payload
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
