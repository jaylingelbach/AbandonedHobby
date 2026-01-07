'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useState } from 'react';
import Link from 'next/link';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { CheckCircle2, ShieldOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn } from '@/lib/utils';

// ─── Project Components ──────────────────────────────────────────────────────
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ─── Project Types / Features ────────────────────────────────────────────────
import { moderationInboxQueryKey } from './queryKeys';
import { ModerationInboxItem } from './types';
import Image from 'next/image';

const BASE_LISTING_CLASS =
  'mt-1 h-8 w-full justify-center px-0 text-xs font-medium underline-offset-4 hover:underline';

interface ModerationRowProps {
  item: ModerationInboxItem;
}
/**
 * Renders a moderation row for a single moderation inbox item, displaying product and reporter metadata and providing controls to approve or remove the listing with an optional internal moderation note.
 *
 * The component shows product/shop information, reporter comments (if any), and three actions: "Meets standards" (approve), "Remove for policy" (remove), and "View listing". Approve/remove actions open confirmation dialogs that accept an optional internal moderation note; confirming sends a POST to the corresponding moderation API endpoint, shows success or error toasts, and invalidates the moderation inbox query to refresh data.
 *
 * @param item - The moderation inbox item to display (product, tenant, flag reason, reporter text, and timestamps).
 * @returns The rendered moderation row element.
 */
export default function ModerationRow({ item }: ModerationRowProps) {
  const {
    id,
    productName,
    tenantName,
    tenantSlug,
    flagReasonLabel,
    flagReasonOtherText,
    thumbnailUrl,
    reportedAtLabel
  } = item;
  const queryClient = useQueryClient();

  const [moderationNote, setModerationNote] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleModerationAction(
    action: 'approve' | 'remove',
    note: string
  ) {
    const data = note ? { moderationNote: note } : {};
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        toast.success(
          action === 'approve'
            ? 'Listing has been approved and removed from the moderation queue.'
            : 'Item has been removed from the marketplace.'
        );
        setModerationNote('');
        queryClient.invalidateQueries({ queryKey: moderationInboxQueryKey });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.error ||
          (response.status === 401
            ? 'Authentication required. Please sign in again.'
            : response.status === 403
              ? 'Not authorized'
              : response.status === 404
                ? 'Product not found'
                : response.status === 409
                  ? 'This listing cannot be moderated in its current state'
                  : 'Failed to submit, please try again');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error(`[moderation dialog] error: ${error}`);
      toast.error('Something went wrong, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

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
            <p className="text-xs text-muted-foreground">{reportedAtLabel}</p>

            <div className="mt-2 inline-flex items-center gap-2 text-xs">
              <span className="rounded-full border border-black bg-yellow-200 px-2 py-0.5 font-semibold uppercase tracking-wide">
                {flagReasonLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: “Other” text / notes */}
        <div className="flex-1 lg:px-4">
          {flagReasonOtherText ? (
            <div className="rounded-md border border-dashed border-black bg-muted px-3 py-2 text-xs leading-relaxed">
              <p className="mb-1 font-semibold uppercase tracking-wide text-[11px] text-muted-foreground">
                Reporter comments
              </p>
              <p className="wrap-anywhere">{flagReasonOtherText}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No additional comments from reporter.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-stretch gap-2 min-w-45">
          {/* Approve / meets standards */}
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setModerationNote('');
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="secondary"
                className={cn(
                  'w-full justify-center rounded-none border-2 border-black bg-white text-sm font-semibold',
                  'hover:bg-green-500 hover:text-white'
                )}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Meets standards
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Approve this listing as meeting community standards?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It will remain on the site and be removed from the moderation
                  queue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {/* Optional internal note for approve */}
              <div className="mt-4 space-y-2">
                <Label htmlFor={`moderation-note-approve-${id}`}>
                  Internal moderation note (optional)
                </Label>
                <Textarea
                  id={`moderation-note-approve-${id}`}
                  placeholder="Optional: briefly explain why this report is being cleared."
                  value={moderationNote}
                  onChange={(event) => setModerationNote(event.target.value)}
                  className="text-xs"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    'border-2 border-black bg-black text-white',
                    'hover:bg-green-500 hover:text-primary'
                  )}
                  onClick={() =>
                    handleModerationAction('approve', moderationNote)
                  }
                  disabled={isSubmitting}
                >
                  Confirm approval
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Remove / violates standards */}
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setModerationNote('');
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                className={cn(
                  'w-full justify-center rounded-none border-2 border-black bg-black text-sm font-semibold text-white',
                  'hover:bg-red-500 hover:text-primary'
                )}
                variant="secondary"
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Remove for policy
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remove this listing for policy violations?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It will be hidden from buyers and marked as removed for a
                  policy violation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {/* Strongly encouraged note for remove */}
              <div className="mt-4 space-y-2">
                <Label htmlFor={`moderation-note-remove-${id}`}>
                  Internal moderation note (optional)
                </Label>
                <Textarea
                  id={`moderation-note-remove-${id}`}
                  placeholder="Optional: briefly explain why this listing is being removed."
                  value={moderationNote}
                  onChange={(event) => setModerationNote(event.target.value)}
                  className="text-xs"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    'border-2 border-black bg-black text-white',
                    'hover:bg-red-500 hover:text-primary'
                  )}
                  onClick={() =>
                    handleModerationAction('remove', moderationNote)
                  }
                  disabled={isSubmitting}
                >
                  Confirm removal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
