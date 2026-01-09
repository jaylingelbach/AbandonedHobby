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
import { moderationInboxQueryKey, removedItemsQueryKey } from './queryKeys';
import { ModerationInboxItem } from './types';
import Image from 'next/image';
import { BASE_LISTING_CLASS } from './constants';
interface ModerationRowProps {
  item: ModerationInboxItem;
}
/**
 * Render a moderation row showing a reported listing and controls to approve or remove it.
 *
 * Displays product and shop metadata, reporter comments (if any), and action controls:
 * confirmation dialogs for approving or removing the listing (each accepts an optional internal moderation note),
 * plus links to view the listing and its payload. Successful moderation actions show a toast and trigger related query invalidation.
 *
 * @param item - ModerationInboxItem containing id, product and tenant fields, flag reason text, thumbnail, and reported timestamp label
 * @returns The rendered moderation row element
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

  /**
   * Submit a moderation action for the current item and update UI state.
   *
   * Sends the specified action ('approve' or 'remove') for the item identified in the component,
   * attaching `note` as an optional internal moderation note. Shows a success toast and clears
   * the note on success, and invalidates the moderation inbox queries (and the removed-items
   * query when `action` is 'remove'). On failure shows an error toast using the server-provided
   * message or a status-based fallback. Manages the `isSubmitting` state for the duration of the request.
   *
   * @param action - The moderation action to perform: `'approve'` or `'remove'`.
   * @param note - Optional internal moderator note to include with the action.
   */
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
        if (action === 'remove') {
          queryClient.invalidateQueries({ queryKey: removedItemsQueryKey });
        }
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
                disabled={isSubmitting}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Approving...' : 'Meets standards'}
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
                  disabled={isSubmitting}
                  onClick={() =>
                    handleModerationAction('approve', moderationNote)
                  }
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
                disabled={isSubmitting}
                variant="secondary"
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Removing...' : 'Remove for policy'}
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
                  disabled={isSubmitting}
                  onClick={() =>
                    handleModerationAction('remove', moderationNote)
                  }
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